import {Component, ViewChild} from '@angular/core';
import {Content, IonicPage, Navbar, NavController, NavParams, ToastController} from 'ionic-angular';
import {Manutention} from "@app/entities/manutention";
import {SqliteProvider} from "@providers/sqlite/sqlite";
import {HttpClient} from "@angular/common/http";
import {MenuPage} from "@pages/menu/menu";
import {ManutentionValidatePage} from "@pages/manutention/manutention-validate/manutention-validate";
import {Network} from "@ionic-native/network";

/**
 * Generated class for the ManutentionMenuPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
    selector: 'page-manutention-menu',
    templateUrl: 'manutention-menu.html',
})
export class ManutentionMenuPage {
    @ViewChild(Navbar) navBar: Navbar;
    @ViewChild(Content) content: Content;
    manutentions: Array<Manutention>;
    dataApi: string = '/api/getManutentions';
    hasLoaded: boolean;
    user: string;

    constructor(
        public navCtrl: NavController,
        public navParams: NavParams,
        public sqlLiteProvider: SqliteProvider,
        public toastController: ToastController,
        public http: HttpClient,
        public network: Network
    ) {
    }

    goHome() {
        this.navCtrl.setRoot(MenuPage);
    }

    ionViewDidLoad() {
        this.synchronise(true);
    }

    synchronise(fromStart: boolean) {
        this.hasLoaded = false;
        if (this.network.type !== 'none') {
            this.sqlLiteProvider.getAPI_URL().subscribe(
                (result) => {
                    if (result !== null) {
                        let url: string = result + this.dataApi;
                        this.sqlLiteProvider.getApiKey().then((key) => {
                            this.http.post<any>(url, {apiKey: key}).subscribe(resp => {
                                if (resp.success) {
                                    this.manutentions = resp.manutentions.map(({date_attendue, ...remainingAttr}) => ({
                                        ...remainingAttr,
                                        date_attendue: date_attendue.date
                                    }));
                                    this.hasLoaded = true;
                                    this.content.resize();
                                } else {
                                    this.hasLoaded = true;
                                    this.showToast('Erreur');
                                }
                            }, error => {
                                this.hasLoaded = true;
                                this.showToast('Erreur réseau');
                            });
                        });
                    } else {
                        this.showToast('Veuillez configurer votre URL dans les paramètres.')
                    }
                },
                err => console.log(err)
            );
        } else {
            this.sqlLiteProvider.findAll('`manutention`').subscribe((manutentions) => {
                this.manutentions = manutentions;
                this.hasLoaded = true;
                this.content.resize();
            })
        }
    }

    async showToast(msg) {
        const toast = await this.toastController.create({
            message: msg,
            duration: 2000,
            position: 'center',
            cssClass: 'toast-error'
        });
        toast.present();
    }

    goToManut(manutention: Manutention) {
        this.navCtrl.push(ManutentionValidatePage, {manutention: manutention});
    }

    toDate(manutention: Manutention) {
        return new Date(manutention.date_attendue);
    }

    escapeQuotes(string) {
        return string.replace(/'/g, "\''");
    }

}
