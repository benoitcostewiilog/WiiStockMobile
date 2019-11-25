import {Component} from '@angular/core';
import {AlertController, IonicPage, NavController, NavParams} from 'ionic-angular';
import {Manutention} from '@app/entities/manutention';
import {SqliteProvider} from '@providers/sqlite/sqlite';
import {HttpClient} from '@angular/common/http';
import {MenuPage} from '@pages/menu/menu';
import {Network} from '@ionic-native/network';
import {ToastService} from '@app/services/toast.service';
import {ApiService} from "@app/services/api.service";
import {StorageService} from '@app/services/storage.service';


@IonicPage()
@Component({
    selector: 'page-manutention-validate',
    templateUrl: 'manutention-validate.html',
})
export class ManutentionValidatePage {
    public manutention: Manutention;
    public commentaire: string;
    public hasLoaded: boolean;
    public showCom: boolean = false;

    public constructor(private alertController: AlertController,
                       private navCtrl: NavController,
                       private navParams: NavParams,
                       private sqliteProvider: SqliteProvider,
                       private client: HttpClient,
                       private toastService: ToastService,
                       private apiService: ApiService,
                       private network: Network,
                       private storageService: StorageService) {
    }

    public ionViewWillEnter(): void {
        if (this.navParams.get('manutention') !== undefined) {
            this.manutention = this.navParams.get('manutention');
        }
        this.synchronise();
    }

    public validateManut(): void {
        if (this.network.type !== 'none') {
            this.alertController.create({
                title: 'Commentez la validation',
                inputs: [{
                    name: 'commentaire',
                    placeholder: 'Commentaire',
                    type: 'text'
                }],
                buttons: [{
                    text: 'Valider',
                    handler: (commentaire) => {
                        this.commentaire = commentaire.commentaire;
                        this.notifyApi();
                    },
                    cssClass: 'alertAlert'
                }]
            }).present();
        } else {
            this.toastService.presentToast('Vous devez être connecté à internet pour valider la demande');
        }
    }

    public notifyApi(): void {
        this.apiService.getApiUrl(ApiService.VALIDATE_MANUT).subscribe((validateManutUrl) => {
            this.storageService.getApiKey().subscribe((key) => {
                let params = {
                    id: this.manutention.id,
                    apiKey: key,
                    commentaire: this.commentaire
                };
                this.client.post<any>(validateManutUrl, params).subscribe((response) => {
                    if (response.success) {
                        this.sqliteProvider.deleteById('`manutention`', this.manutention.id).subscribe(() => {
                            this.navCtrl.pop();
                        })
                    } else {
                        this.toastService.presentToast(response.msg);
                    }
                });
            });
        });
    }

    public synchronise(): void {
        this.hasLoaded = false;
        this.sqliteProvider.findOneById('`manutention`', this.manutention.id).subscribe(manutention => {
            this.manutention = manutention;
            this.hasLoaded = true;
        })
    }

    public goHome(): void {
        this.navCtrl.setRoot(MenuPage);
    }

    public toDate(manutention: Manutention): Date {
        return new Date(manutention.date_attendue);
    }

    public showCommentaire(): void {
        this.showCom = !this.showCom;
    }
}
