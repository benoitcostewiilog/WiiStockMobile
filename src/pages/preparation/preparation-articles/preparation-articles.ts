import {Component, ViewChild} from '@angular/core';
import {IonicPage, Navbar, NavController, NavParams} from 'ionic-angular';
import {MenuPage} from '@pages/menu/menu';
import {Preparation} from '@app/entities/preparation';
import {SqliteProvider} from '@providers/sqlite/sqlite';
import {ArticlePrepa} from '@app/entities/article-prepa';
import {Mouvement} from '@app/entities/mouvement';
import {PreparationArticleTakePage} from '@pages/preparation/preparation-article-take/preparation-article-take';
import {HttpClient} from '@angular/common/http';
import {PreparationEmplacementPage} from '@pages/preparation/preparation-emplacement/preparation-emplacement';
import moment from 'moment';
import {PreparationRefArticlesPage} from '@pages/preparation/preparation-ref-articles/preparation-ref-articles';
import {Observable, Subscription} from 'rxjs';
import {flatMap, map} from 'rxjs/operators';
import {ArticlePrepaByRefArticle} from '@app/entities/article-prepa-by-ref-article';
import {of} from 'rxjs/observable/of';
import {ToastService} from '@app/services/toast.service';
import {BarcodeScannerManagerService} from '@app/services/barcode-scanner-manager.service';
import {Network} from '@ionic-native/network';
import {ApiService} from '@app/services/api.service';
import {StorageService} from '@app/services/storage.service';


@IonicPage()
@Component({
    selector: 'page-preparation-articles',
    templateUrl: 'preparation-articles.html',
})
export class PreparationArticlesPage {

    @ViewChild(Navbar)
    public navBar: Navbar;

    public preparation: Preparation;
    public articlesNT: Array<ArticlePrepa>;
    public articlesT: Array<ArticlePrepa>;
    public started: boolean = false;
    public isValid: boolean = true;

    public loadingStartPreparation: boolean;

    private zebraScannerSubscription: Subscription;

    public constructor(private navCtrl: NavController,
                       private navParams: NavParams,
                       private sqliteProvider: SqliteProvider,
                       private http: HttpClient,
                       private barcodeScannerManager: BarcodeScannerManagerService,
                       private toastService: ToastService,
                       private network: Network,
                       private apiService: ApiService,
                       private storageService: StorageService) {
        this.loadingStartPreparation = false;
    }

    public ionViewWillEnter(): void {
        this.preparation = this.navParams.get('preparation');
        this.updateLists().subscribe(() => {
            if (this.articlesT.length > 0) {
                this.started = true;
            }
        });

        this.zebraScannerSubscription = this.barcodeScannerManager.zebraScan$.subscribe((barcode) => {
            this.testIfBarcodeEquals(barcode);
        });
    }

    public ionViewWillLeave(): void {
        if (this.zebraScannerSubscription) {
            this.zebraScannerSubscription.unsubscribe();
            this.zebraScannerSubscription = undefined;
        }
    }

    public ionViewCanLeave(): boolean {
        return this.barcodeScannerManager.canGoBack;
    }

    public scan(): void {
        this.barcodeScannerManager.scan().subscribe(barcode => {
            this.testIfBarcodeEquals(barcode);
        });
    }

    public saveSelectedArticle(selectedArticle: ArticlePrepa | ArticlePrepaByRefArticle, selectedQuantity: number): void {
        // if preparation is valid
        if (this.isValid) {
            // check if article is managed by 'article'
            const isSelectableByUser = ((selectedArticle as ArticlePrepaByRefArticle).isSelectableByUser);
            const availableQuantity = isSelectableByUser
                ? (selectedArticle as ArticlePrepaByRefArticle).quantity
                : (selectedArticle as ArticlePrepa).quantite;

            // if the quantity selected is smaller than the number of article
            if (availableQuantity !== selectedQuantity) {
                const {id_prepa, is_ref, reference} = (selectedArticle as ArticlePrepa);

                // check if we alreay have selected the article
                let articleAlready = this.articlesT.find(art => (
                    (art.id_prepa === id_prepa) &&
                    (art.is_ref === is_ref) &&
                    (art.reference === reference)
                ));
                if (articleAlready !== undefined) {
                    // we update the quantity in the list of treated article
                    this.sqliteProvider.updateArticlePrepaQuantity(reference, id_prepa, Number(is_ref), Number(selectedQuantity) + Number(articleAlready.quantite))
                        .pipe(
                            // we update quantity in the list of untreated articles
                            flatMap(() => this.sqliteProvider.updateArticlePrepaQuantity(reference, id_prepa, Number(is_ref), (selectedArticle as ArticlePrepa).quantite - selectedQuantity)),
                        )
                        .subscribe(() => {
                            this.updateViewLists();
                        });
                } else {
                    if (isSelectableByUser) {
                        this.moveArticle(selectedArticle, selectedQuantity)
                            .subscribe(() => {
                                this.updateViewLists();
                            });
                    } else {
                        // we update value quantity of selected article
                        this.sqliteProvider
                            .updateArticlePrepaQuantity(reference, id_prepa, Number(is_ref), (selectedArticle as ArticlePrepa).quantite - selectedQuantity)
                            .pipe(flatMap(() => this.moveArticle(selectedArticle, selectedQuantity)))
                            .subscribe(() => {
                                this.updateViewLists();
                            })
                    }
                }
            }
            // if we select all the article
            else {
                let mouvement: Mouvement = {
                    id: null,
                    reference: selectedArticle.reference,
                    selected_by_article: isSelectableByUser ? 1 : 0,
                    quantity: isSelectableByUser
                        ? (selectedArticle as ArticlePrepaByRefArticle).quantity
                        : (selectedArticle as ArticlePrepa).quantite,
                    date_pickup: moment().format(),
                    location_from: isSelectableByUser
                        ? (selectedArticle as ArticlePrepaByRefArticle).location
                        : (selectedArticle as ArticlePrepa).emplacement,
                    date_drop: null,
                    location: null,
                    type: 'prise-dépose',
                    is_ref: isSelectableByUser
                        ? 0
                        : (selectedArticle as ArticlePrepa).is_ref,
                    id_article_prepa: isSelectableByUser
                        ? null
                        : (selectedArticle as ArticlePrepa).id,
                    id_prepa: this.preparation.id,
                    id_article_livraison: null,
                    id_livraison: null,
                    id_article_collecte: null,
                    id_collecte: null,
                };
                let articleAlready;
                if (!isSelectableByUser) {
                    articleAlready = this.articlesT.find(art => (
                        (art.id_prepa === mouvement.id_prepa) &&
                        (art.is_ref === mouvement.is_ref) &&
                        (art.reference === mouvement.reference)
                    ));
                }

                if (articleAlready) {
                    // we don't enter here if it's an article selected by the user in the liste of article_prepa_by_ref_article
                    this.sqliteProvider
                        .updateArticlePrepaQuantity(articleAlready.reference, articleAlready.id_prepa, Number(articleAlready.is_ref), mouvement.quantity + articleAlready.quantite)
                        .pipe(flatMap(() => this.sqliteProvider.deleteArticlePrepa(articleAlready.reference, articleAlready.id_prepa, Number(articleAlready.is_ref))))
                        .subscribe(() => this.updateViewLists());
                } else {
                    this.moveArticle(selectedArticle)
                        .subscribe(() => {
                            this.updateViewLists();
                        });
                }
            }
        }
    }

    private refreshOver(): void {
        this.loadingStartPreparation = false;
        this.toastService.presentToast('Préparation prête à être finalisée.')
    }

    private refresh(): void {
        this.loadingStartPreparation = false;
        this.toastService.presentToast('Quantité bien prélevée.')
    }

    private selectArticle(selectedArticle: ArticlePrepa | ArticlePrepaByRefArticle, selectedQuantity: number): void {
        if (selectedArticle && selectedQuantity) {
            // we start preparation
            if (!this.started) {
                if (this.network.type !== 'none') {
                    this.loadingStartPreparation = true;
                    this.apiService.getApiUrl(ApiService.BEGIN_PREPA).subscribe((beginPrepaUrl) => {
                        this.storageService.getApiKey().subscribe((key) => {
                            this.http.post<any>(beginPrepaUrl, {id: this.preparation.id, apiKey: key}).subscribe(resp => {
                                if (resp.success) {
                                    this.started = true;
                                    this.isValid = true;
                                    this.sqliteProvider.startPrepa(this.preparation.id).subscribe(() => {
                                        this.toastService.presentToast('Préparation commencée.');
                                        this.saveSelectedArticle(selectedArticle, selectedQuantity);
                                    });
                                }
                                else {
                                    this.isValid = false;
                                    this.loadingStartPreparation = false;
                                    this.toastService.presentToast(resp.msg);
                                }
                            });
                        });
                    });
                }
                else {
                    this.toastService.presentToast('Vous devez être connecté à internet pour commencer la préparation');
                }
            } else {
                this.saveSelectedArticle(selectedArticle, selectedQuantity);
            }
        }
    }

    public goHome(): void {
        this.navCtrl.setRoot(MenuPage);
    }

    public validate(): void {
        if (this.articlesNT.length > 0) {
            this.toastService.presentToast('Veuillez traiter tous les articles concernés');
        } else {
            this.navCtrl.push(PreparationEmplacementPage, {
                preparation: this.preparation,
                validatePrepa: () => {
                    this.navCtrl.pop();
                }
            })
        }
    }

    public testIfBarcodeEquals(selectedArticleGiven: ArticlePrepa | string, fromClick = false): void {
        let selectedArticle: ArticlePrepa = (
            !fromClick // selectedArticleGiven is a barcode
                ? this.articlesNT.find(article => ((article.barcode === selectedArticleGiven)))
                : (selectedArticleGiven as ArticlePrepa) // if it's a click we have the article directly
        );

        // if we scan an article which is not in the list
        // Then we check if it's linked to a refArticle in the list
        if (!fromClick && !selectedArticle) {
            this.getArticleByBarcode(selectedArticleGiven as string).subscribe((result) => {
                // result = {selectedArticle, refArticle}
                this.navigateToPreparationTake(result);
            });
        } else if (selectedArticle && (selectedArticle as ArticlePrepa).type_quantite === 'article') {
            this.navCtrl.push(PreparationRefArticlesPage, {
                article: selectedArticle,
                preparation: this.preparation,
                started: this.started,
                valid: this.isValid,
                getArticleByBarcode: (barcode: string) => this.getArticleByBarcode(barcode),
                selectArticle: (selectedQuantity: number, selectedArticleByRef: ArticlePrepaByRefArticle) => this.selectArticle(selectedArticleByRef, selectedQuantity)
            });
        } else {
            this.navigateToPreparationTake({selectedArticle: (selectedArticle as ArticlePrepa)});
        }

    }

    private getArticleByBarcode(barcode: string): Observable<{ selectedArticle?: ArticlePrepaByRefArticle, refArticle?: ArticlePrepa }> {
        return this.sqliteProvider.findBy('article_prepa_by_ref_article', [`barcode LIKE '${barcode}'`]).pipe(
            // we get the article
            map((result) => (
                (result && result.length > 0)
                    ? result[0]
                    : undefined
            )),
            flatMap((selectedArticle?: ArticlePrepaByRefArticle) => (
                !selectedArticle
                    ? of({selectedArticle})
                    : (
                        this.sqliteProvider
                            .findOneBy('article_prepa', {reference: selectedArticle.reference_article, is_ref: 1, id_prepa: this.preparation.id}, 'AND')
                            .pipe(map((refArticle) => (
                                    refArticle
                                        ? ({selectedArticle, refArticle})
                                        : {selectedArticle: undefined}
                                ))
                            )

                    )))
        );
    }

    private navigateToPreparationTake({selectedArticle, refArticle}: { selectedArticle?: ArticlePrepaByRefArticle | ArticlePrepa, refArticle?: ArticlePrepa }): void {
        if (selectedArticle) {
            this.navCtrl.push(PreparationArticleTakePage, {
                article: selectedArticle,
                refArticle,
                preparation: this.preparation,
                started: this.started,
                valid: this.isValid,
                selectArticle: (selectedQuantity: number) => this.selectArticle(selectedArticle, selectedQuantity)
            });
        } else {
            this.toastService.presentToast('L\'article scanné n\'est pas dans la liste.');
        }
    }

    private updateLists(): Observable<undefined> {
        return this.sqliteProvider.findArticlesByPrepa(this.preparation.id).pipe(
            flatMap((articlesPrepa: Array<ArticlePrepa>) => {
                this.articlesNT = articlesPrepa.filter(article => article.has_moved === 0);
                this.articlesT = articlesPrepa.filter(article => article.has_moved === 1);
                return of(undefined);
            }));
    }

    private updateViewLists(): void {
        this.updateLists().subscribe(() => {
            if (this.articlesNT.length === 0) {
                this.refreshOver();
            } else {
                this.refresh();
            }
        });
    }

    private moveArticle(selectedArticle, selectedQuantity?: number): Observable<any> {
        const selectedQuantityValid = selectedQuantity ? selectedQuantity : (selectedArticle as ArticlePrepaByRefArticle).quantity;
        let articleToInsert: ArticlePrepa = {
            label: (selectedArticle as ArticlePrepaByRefArticle).label,
            reference: (selectedArticle as ArticlePrepaByRefArticle).reference,
            is_ref: 1,
            has_moved: 1,
            id_prepa: this.preparation.id,
            isSelectableByUser: 1,
            emplacement: (selectedArticle as ArticlePrepaByRefArticle).location,
            quantite: selectedQuantityValid
        };
        return ((selectedArticle as ArticlePrepaByRefArticle).isSelectableByUser)
            ? this.sqliteProvider
                .insert('article_prepa', articleToInsert)
                .pipe(
                    flatMap((insertId) => (
                        this.insertMouvement(
                            selectedArticle as ArticlePrepaByRefArticle & ArticlePrepa,
                            selectedQuantityValid,
                            insertId
                        )
                    )),
                    flatMap(() => this.sqliteProvider.deleteById('article_prepa_by_ref_article', selectedArticle.id)),
                    flatMap(() => this.updateLists()),

                    // delete articlePrepa if all quantity has been selected
                    flatMap(() => (
                        this.sqliteProvider.findOneBy('article_prepa', {
                            reference: (selectedArticle as ArticlePrepaByRefArticle).reference_article,
                            is_ref: 1,
                            id_prepa: this.preparation.id
                        }, 'AND')
                    )),
                    flatMap((referenceArticle) => {

                        // we get all quantity picked for this refArticle plus the current quantity which is selected
                        const quantityPicked = this.articlesT.reduce((acc: number, article: ArticlePrepa) => (
                            acc +
                            ((article.isSelectableByUser && ((selectedArticle as ArticlePrepaByRefArticle).reference_article === article.reference))
                                ? Number(article.quantite)
                                : 0)
                        ), selectedQuantityValid);

                        return (referenceArticle.quantite === quantityPicked)
                            ? this.sqliteProvider.deleteArticlePrepa(referenceArticle.reference, referenceArticle.id_prepa, 1)
                            : this.sqliteProvider.updateArticlePrepaQuantity(referenceArticle.reference, referenceArticle.id_prepa, 1, referenceArticle.quantite - selectedQuantityValid)
                    })
                )
            : (selectedQuantity
                    ? this.sqliteProvider.insert('article_prepa', articleToInsert)
                        .pipe(
                            flatMap((insertId) => (
                                    this.insertMouvement(selectedArticle as ArticlePrepaByRefArticle & ArticlePrepa, selectedQuantityValid, insertId).pipe(
                                        flatMap(() => this.sqliteProvider.moveArticle(insertId))
                                    )
                                )
                            ))
                    : this.insertMouvement(selectedArticle as ArticlePrepaByRefArticle & ArticlePrepa, selectedQuantityValid)
                        .pipe(
                            flatMap(() => this.sqliteProvider.moveArticle((selectedArticle as ArticlePrepa).id))
                        )
            )
    }

    private insertMouvement(selectedArticle: ArticlePrepaByRefArticle & ArticlePrepa, quantity: number, insertId?: number): Observable<number> {
        if (!this.articlesT.some(art => art.reference === selectedArticle.reference)) {
            let mouvement: Mouvement = {
                id: null,
                reference: selectedArticle.reference,
                quantity: quantity ? quantity : selectedArticle.quantite,
                date_pickup: moment().format(),
                location_from: selectedArticle.location ? selectedArticle.location : selectedArticle.emplacement,
                date_drop: null,
                location: null,
                type: 'prise-dépose',
                is_ref: selectedArticle.isSelectableByUser ? 0 : selectedArticle.is_ref,
                selected_by_article: selectedArticle.isSelectableByUser ? 1 : 0,
                id_article_prepa: insertId ? insertId : selectedArticle.id,
                id_prepa: this.preparation.id,
                id_article_livraison: null,
                id_article_collecte: null,
                id_collecte: null,
                id_livraison: null
            };
            return this.sqliteProvider.insert('`mouvement`', mouvement);
        } else {
            return of(undefined);
        }
    }

}
