import {ChangeDetectionStrategy, ChangeDetectorRef, Component} from '@angular/core';
import {IonicPage, NavController, NavParams} from 'ionic-angular';
import {UsersApiProvider} from '@providers/users-api/users-api';
import {MenuPage} from '@pages/menu/menu';
import {ParamsPage} from '@pages/params/params'
import {SqliteProvider} from '@providers/sqlite/sqlite';
import {ToastService} from '@app/services/toast.service';
import {Network} from '@ionic-native/network';
import {BarcodeScannerManagerService} from '@app/services/barcode-scanner-manager.service';
import {flatMap} from 'rxjs/operators';
import {StorageService} from '@app/services/storage.service';


@IonicPage()
@Component({
    selector: 'page-connect',
    templateUrl: 'connect.html',
    // to resolve ExpressionChangedAfterItHasBeenCheckedError error on emulator
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConnectPage {

    public form = {
        login: '',
        password: ''
    };
    public connectURL: string = '/api/connect';
    public isLoaded: boolean;

    public constructor(public navCtrl: NavController,
                       public navParams: NavParams,
                       public usersApiProvider: UsersApiProvider,
                       private toastService: ToastService,
                       public sqliteProvider: SqliteProvider,
                       private changeDetector: ChangeDetectorRef,
                       private network: Network,
                       private barcodeScannerManager: BarcodeScannerManagerService,
                       private storageService: StorageService) {
        this.isLoaded = false;
    }

    public logForm(): void {
        if (!this.isLoaded) {
            if (this.network.type !== 'none') {
                this.isLoaded = true;
                this.sqliteProvider.getAPI_URL().subscribe((result) => {
                    if (result !== null) {
                        let url: string = result + this.connectURL;
                        this.usersApiProvider.setProvider(this.form, url).subscribe(
                            ({data, success}) => {
                                if (success) {
                                    const {apiKey, isInventoryManager} = data;
                                    this.sqliteProvider
                                        .resetDataBase()
                                        .pipe(flatMap(() => this.storageService.initStorage(apiKey, this.form.login, isInventoryManager)))
                                        .subscribe(
                                            () => {
                                                this.isLoaded = false;
                                                this.barcodeScannerManager.registerZebraBroadcastReceiver();
                                                this.navCtrl.setRoot(MenuPage, {needReload : false});
                                            },
                                            (err) => {
                                                this.finishLoading();
                                                console.log(err)
                                            });
                                } else {
                                    this.finishLoading();
                                    this.toastService.showToast('Identifiants incorrects.');
                                }
                            },
                            () => {
                                this.finishLoading();
                                this.toastService.showToast('Un problème est survenu, veuillez vérifier vos identifiants ainsi que l\'URL saisie sans les paramètres.');
                            });
                    } else {
                        this.finishLoading();
                        this.toastService.showToast('Veuillez configurer votre URL dans les paramètres.');
                    }
                });
            } else {
                this.toastService.showToast('Vous devez être connecté à internet pour vous authentifier');
            }
        }
    }

    public goToParams(): void {
        if (!this.isLoaded) {
            this.isLoaded = false;
            this.navCtrl.push(ParamsPage);
        }
    }

    private finishLoading() {
        this.isLoaded = false;
        this.changeDetector.detectChanges();
    }
}
