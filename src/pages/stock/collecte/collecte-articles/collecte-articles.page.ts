import {Component, ViewChild} from '@angular/core';
import {BarcodeScannerComponent} from '@app/common/components/barcode-scanner/barcode-scanner.component';
import {Collecte} from '@entities/collecte';
import {ArticleCollecte} from '@entities/article-collecte';
import {HeaderConfig} from '@app/common/components/panel/model/header-config';
import {ListPanelItemConfig} from '@app/common/components/panel/model/list-panel/list-panel-item-config';
import {IconConfig} from '@app/common/components/panel/model/icon-config';
import {ToastService} from '@app/common/services/toast.service';
import {SqliteService} from '@app/common/services/sqlite/sqlite.service';
import {Network} from '@ionic-native/network/ngx';
import {LocalDataManagerService} from '@app/common/services/local-data-manager.service';
import {AlertController} from '@ionic/angular';
import {ApiService} from '@app/common/services/api.service';
import {NavService} from '@app/common/services/nav.service';
import {flatMap} from 'rxjs/operators';
import {Mouvement} from '@entities/mouvement';
import * as moment from 'moment';
import {from, Observable, of, zip} from 'rxjs';
import {AlertManagerService} from '@app/common/services/alert-manager.service';
import {IconColor} from '@app/common/components/icon/icon-color';
import {CollecteArticleTakePageRoutingModule} from '@pages/stock/collecte/collecte-article-take/collecte-article-take-routing.module';
import {CanLeave} from '@app/guards/can-leave/can-leave';


@Component({
    selector: 'wii-collecte-articles',
    templateUrl: './collecte-articles.page.html',
    styleUrls: ['./collecte-articles.page.scss'],
})
export class CollecteArticlesPage implements CanLeave {
    @ViewChild('footerScannerComponent', {static: false})
    public footerScannerComponent: BarcodeScannerComponent;

    public collecte: Collecte;

    public articlesNT: Array<ArticleCollecte>;
    public articlesT: Array<ArticleCollecte>;

    public listBoldValues?: Array<string>;
    public listToTreatConfig?: { header: HeaderConfig; body: Array<ListPanelItemConfig>; };
    public listTreatedConfig?: { header: HeaderConfig; body: Array<ListPanelItemConfig>; };
    public collecteHeaderConfig?: {
        leftIcon: IconConfig;
        title: string;
        subtitle?: string;
        info?: string;
    };

    public started: boolean = false;
    public isValid: boolean = true;
    public loadingStartCollecte: boolean;

    private partialCollecteAlert: HTMLIonAlertElement;

    private isLoading: boolean;

    private goToDepose: () => void;
    private canLeave: boolean;

    public constructor(private navService: NavService,
                       private toastService: ToastService,
                       private sqliteService: SqliteService,
                       private network: Network,
                       private localDataManager: LocalDataManagerService,
                       private alertController: AlertController,
                       private apiService: ApiService) {
        this.loadingStartCollecte = false;
        this.isLoading = false;
        this.canLeave = true;
    }

    public ionViewWillEnter(): void {
        this.isLoading = false;
        const navParams = this.navService.getCurrentParams();
        this.collecte = navParams.get('collecte');
        this.goToDepose = navParams.get('goToDepose');

        this.collecteHeaderConfig = {
            leftIcon: {name: 'collecte.svg'},
            title: `Collecte ${this.collecte.number}`,
            subtitle: `Point de collecte : ${this.collecte.location_from ? this.collecte.location_from : ''}`,
            info: this.collecte.forStock ? 'Mise en stock' : 'Destruction'
        };

        this.listBoldValues = ['reference', 'barCode', 'location', 'quantity'];

        if (this.footerScannerComponent) {
            this.footerScannerComponent.fireZebraScan();
        }

        this.sqliteService.findArticlesByCollecte(this.collecte.id).subscribe((articles) => {
            this.updateList(articles, true);
            if (this.articlesT.length > 0) {
                this.started = true;
            }
        });
    }

    public ionViewWillLeave(): void {
        if (this.footerScannerComponent) {
            this.footerScannerComponent.unsubscribeZebraScan();
        }
    }

    public wiiCanLeave(): boolean {
        return this.canLeave;
    }

    public refreshOver(): void {
        this.toastService.presentToast('Collecte prête à être finalisée.')
    }

    public refresh(): void {
        this.toastService.presentToast('Quantité bien prélevée.')
    }

    public registerMvt(article, quantite): void {
        if (this.isValid) {
            if (article.quantite !== Number(quantite)) {
                let newArticle: ArticleCollecte = {
                    id: null,
                    label: article.label,
                    reference: article.reference,
                    quantite: Number(quantite),
                    is_ref: article.is_ref,
                    id_collecte: article.id_collecte,
                    has_moved: 1,
                    emplacement: article.emplacement,
                    barcode: article.barcode,
                };
                let articleAlready = this.articlesT.find(art => (
                    (art.id_collecte === newArticle.id_collecte) &&
                    (art.barcode === newArticle.barcode)
                ));
                if (articleAlready !== undefined) {
                    this.sqliteService
                        .updateArticleCollecteQuantity(articleAlready.id, newArticle.quantite + articleAlready.quantite)
                        .pipe(
                            flatMap(() => this.sqliteService.updateArticleCollecteQuantity(article.id, article.quantite - newArticle.quantite)),
                            flatMap(() => this.sqliteService.findArticlesByCollecte(this.collecte.id))
                        )
                        .subscribe((articles) => {
                            this.updateList(articles);
                        });
                } else {
                    this.sqliteService.insert('`article_collecte`', newArticle).subscribe((insertId) => {
                        let mouvement: Mouvement = {
                            id: null,
                            barcode: newArticle.barcode,
                            reference: newArticle.reference,
                            quantity: Number(quantite),
                            date_pickup: moment().format(),
                            location_from: newArticle.emplacement,
                            date_drop: null,
                            location: null,
                            type: 'prise-dépose',
                            is_ref: newArticle.is_ref,
                            id_article_prepa: null,
                            id_prepa: null,
                            id_article_livraison: null,
                            id_livraison: null,
                            id_article_collecte: insertId,
                            id_collecte: newArticle.id_collecte
                        };
                        this.sqliteService.updateArticleCollecteQuantity(article.id, article.quantite - Number(quantite))
                            .pipe(
                                flatMap(() => this.sqliteService.insert('`mouvement`', mouvement)),
                                flatMap(() => this.sqliteService.findArticlesByCollecte(this.collecte.id)))
                            .subscribe((articles) => {
                                this.updateList(articles);
                            });
                    });
                }
            } else {
                let mouvement: Mouvement = {
                    id: null,
                    reference: article.reference,
                    quantity: article.quantite,
                    barcode: article.barcode,
                    date_pickup: moment().format(),
                    location_from: article.emplacement,
                    date_drop: null,
                    location: null,
                    type: 'prise-dépose',
                    is_ref: article.is_ref,
                    id_article_prepa: null,
                    id_prepa: null,
                    id_article_livraison: null,
                    id_livraison: null,
                    id_article_collecte: article.id,
                    id_collecte: article.id_collecte
                };
                let articleAlready = this.articlesT.find(art => (
                    (art.id_collecte === mouvement.id_collecte) &&
                    (art.is_ref === mouvement.is_ref) &&
                    (art.reference === mouvement.reference)
                ));
                if (articleAlready !== undefined) {
                    this.sqliteService
                        .updateArticleCollecteQuantity(articleAlready.id, mouvement.quantity + articleAlready.quantite)
                        .pipe(
                            flatMap(() => this.sqliteService.deleteBy('`article_collecte`', [`id = ${mouvement.id_article_collecte}`])),
                            flatMap(() => this.sqliteService.findArticlesByCollecte(this.collecte.id))
                        )
                        .subscribe((articles) => {
                            this.updateList(articles);
                        });
                } else {
                    this.sqliteService
                        .insert('`mouvement`', mouvement)
                        .pipe(
                            flatMap(() => this.sqliteService.moveArticleCollecte(article.id)),
                            flatMap(() => this.sqliteService.findArticlesByCollecte(this.collecte.id))
                        )
                        .subscribe((articles) => {
                            this.updateList(articles);
                        });
                }
            }
        }
    }

    public validate(): void {
        if (this.articlesT.length === 0) {
            this.toastService.presentToast('Veuillez sélectionner au moins une ligne');
        } else if (this.articlesNT.length > 0) {
            this.alertPartialCollecte();
        } else {
            this.finishCollecte();
        }
    }

    public testIfBarcodeEquals(text, fromText = true): void {
        const article = fromText
            ? this.articlesNT.find(article => (article.barcode === text))
            : text;
        if (article) {
            this.navService.push(CollecteArticleTakePageRoutingModule.PATH, {
                article,
                selectArticle: (quantity: number) => {
                    this.selectArticle(article, quantity);
                }
            });
        }
        else {
            this.toastService.presentToast('L\'article scanné n\'est pas dans la liste.');
        }
    }

    private alertPartialCollecte(): void {
        if (this.partialCollecteAlert) {
            this.partialCollecteAlert.dismiss();
            this.partialCollecteAlert = undefined;
        } else {
             from(this.alertController
                .create({
                    header: `Votre collecte est partielle`,
                    backdropDismiss: false,
                    buttons: [
                        {
                            text: 'Annuler',
                            handler: () => {
                                this.partialCollecteAlert = undefined;
                            }
                        },
                        {
                            text: 'Continuer',
                            handler: () => {
                                this.partialCollecteAlert = undefined;
                                this.finishCollecte();
                            },
                            cssClass: 'alert-success'
                        }
                    ]
                }))
                 .subscribe((alert) => {
                     this.partialCollecteAlert = alert;
                     this.partialCollecteAlert.present();
                 });
        }
    }

    private selectArticle(article, quantity): void {
        if (!this.started && this.network.type !== 'none') {
            this.loadingStartCollecte = true;
            this.apiService
                .requestApi('post', ApiService.BEGIN_COLLECTE, {params: {id: this.collecte.id}})
                .subscribe((resp) => {
                    if (resp.success) {
                        this.started = true;
                        this.isValid = true;
                        this.toastService.presentToast('Collecte commencée.');
                        this.registerMvt(article, quantity);
                    } else {
                        this.isValid = false;
                        this.loadingStartCollecte = false;
                        this.toastService.presentToast(resp.msg);
                    }
                });
        }
        else {
            if (this.network.type === 'none') {
                this.toastService.presentToast('Collecte commencée en mode hors ligne');
            }

            this.registerMvt(article, quantity);
        }
    }

    private updateList(articles: Array<ArticleCollecte>, isInit: boolean = false): void {
        this.articlesNT = articles.filter(({has_moved}) => (has_moved === 0));
        this.articlesT = articles.filter(({has_moved}) => (has_moved === 1));

        this.listToTreatConfig = this.createListToTreatConfig();
        this.listTreatedConfig = this.ceateListTreatedConfig();

        if (!isInit) {
            if (this.articlesNT.length === 0) {
                this.refreshOver();
            }
            else {
                this.refresh();
            }
            this.loadingStartCollecte = false;
        }
    }

    private finishCollecte(): void {
        if (!this.isLoading) {
            this.isLoading = true;

            this.canLeave = false;
            this.sqliteService
                .findArticlesByCollecte(this.collecte.id)
                .pipe(
                    flatMap((articles) => zip(
                        ...articles.map((article) => (
                            this.sqliteService
                                .findMvtByArticleCollecte(article.id)
                                .pipe(flatMap((mvt) => (
                                    mvt
                                        ? this.sqliteService.finishMvt(mvt.id)
                                        : of(undefined)
                                )))
                        ))
                    )),
                    flatMap(() => this.sqliteService.finishCollecte(this.collecte.id)),
                    flatMap((): any => (
                        this.network.type !== 'none'
                            ? this.localDataManager.sendFinishedProcess('collecte')
                            : of({offline: true})
                    ))
                )
                .subscribe(
                    ({offline, success}: any) => {
                        if (this.collecte && this.collecte.forStock) {
                            from(this.alertController
                                .create({
                                    header: 'Collecte validée',
                                    cssClass: AlertManagerService.CSS_CLASS_MANAGED_ALERT,
                                    message: 'Pour valider l\'entrée en stock vous devez effectuer la dépose',
                                    buttons: [{
                                        text: 'Aller vers la dépose',
                                        cssClass: 'alert-success',
                                        handler: () => {
                                            this.canLeave = true;
                                            this.closeScreen(offline ? [] : success, offline).subscribe(() => {
                                                this.goToDepose();
                                            });
                                        }
                                    }]
                                }))
                                .subscribe((alert: HTMLIonAlertElement) => {
                                    alert.present();
                                });
                        }
                        else {
                            this.canLeave = true;
                            this.closeScreen(offline ? [] : success, offline);
                        }
                    },
                    (error) => {
                        this.handlePreparationError(error);
                    });
        } else {
            this.toastService.presentToast('Chargement en cours veuillez patienter.');
        }
    }

    private closeScreen(success: Array<{ newCollecte, articlesCollecte }>, isOffline: boolean = false): Observable<void> {
        if(isOffline || success.length > 0) {
            this.toastService.presentToast(
                (success.length > 0)
                    ? (
                        (success.length === 1
                            ? 'Votre collecte a bien été enregistrée'
                            : `Votre collecte et ${success.length - 1} collecte${success.length - 1 > 1 ? 's' : ''} en attente ont bien été enregistrées`)
                    )
                    : 'Collecte sauvegardée localement, nous l\'enverrons au serveur une fois internet retrouvé'
            );
        }

        this.isLoading = false;
        return this.navService.pop();
    }

    private handlePreparationError(resp): void {
        this.isLoading = false;
        this.toastService.presentToast((resp && resp.api && resp.message) ? resp.message : 'Une erreur s\'est produite');
    }

    private createListToTreatConfig(): { header: HeaderConfig; body: Array<ListPanelItemConfig>; } {
        const articlesNumber = (this.articlesNT ? this.articlesNT.length : 0);
        const articlesPlural = articlesNumber > 1 ? 's' : '';
        return articlesNumber > 0
            ? {
                header: {
                    title: 'À collecter',
                    info: `${articlesNumber} article${articlesPlural} à scanner`,
                    leftIcon: {
                        name: 'download.svg',
                        color: 'list-orange-light'
                    }
                },
                body: this.articlesNT.map((articleCollecte: ArticleCollecte) => ({
                    infos: this.createArticleInfo(articleCollecte),
                    rightIcon: {
                        color: 'grey' as IconColor,
                        name: 'up.svg',
                        action: () => {
                            this.testIfBarcodeEquals(articleCollecte, false)
                        }
                    }
                }))
            }
            : undefined;
    }

    private ceateListTreatedConfig(): { header: HeaderConfig; body: Array<ListPanelItemConfig>; } {
        const pickedArticlesNumber = (this.articlesT ? this.articlesT.length : 0);
        const pickedArticlesPlural = pickedArticlesNumber > 1 ? 's' : '';
        return {
            header: {
                title: 'Collecté',
                info: `${pickedArticlesNumber} article${pickedArticlesPlural} scanné${pickedArticlesPlural}`,
                leftIcon: {
                    name: 'upload.svg',
                    color: 'list-orange'
                },
                rightIcon: {
                    name: 'check.svg',
                    color: 'success',
                    action: () => {
                        this.validate()
                    }
                }
            },
            body: this.articlesT.map((articleCollecte: ArticleCollecte) => ({
                infos: this.createArticleInfo(articleCollecte)
            }))
        };
    }

    private createArticleInfo({reference, barcode, emplacement, quantite}: ArticleCollecte): {[name: string]: { label: string; value: string; }} {
        return {
            reference: {
                label: 'Référence',
                value: reference
            },
            barCode: {
                label: 'Code barre',
                value: barcode
            },
            ...(
                emplacement && emplacement !== 'null'
                    ? {
                        location: {
                            label: 'Emplacement',
                            value: emplacement
                        }
                    }
                    : {}
            ),
            ...(
                quantite
                    ? {
                        quantity: {
                            label: 'Quantité',
                            value: `${quantite}`
                        }
                    }
                    : {}
            )
        };
    }
}
