import {Component} from '@angular/core';
import {IonicPage, NavController, NavParams, ToastController} from 'ionic-angular';
import {Article} from "../../../app/entities/article";
import {SqliteProvider} from "../../../providers/sqlite/sqlite";
import {Emplacement} from "../../../app/entities/emplacement";
import {IonicSelectableComponent} from "ionic-selectable";
import {DeposeArticlesPageTraca} from "../depose-articles/depose-articles-traca";

@IonicPage()
@Component({
    selector: 'page-depose-confirm',
    templateUrl: 'depose-confirm-traca.html',
})
export class DeposeConfirmPageTraca {

    article: Article;
    articles: Array<Article>;
    db_articles: Array<Article>;
    emplacement: Emplacement;

    constructor(public navCtrl: NavController, public navParams: NavParams, public sqliteProvider: SqliteProvider, private toastController: ToastController) {
        this.articles = navParams.get('articles');
        this.emplacement = navParams.get('emplacement');
        if (navParams.get('selectedArticle') !== undefined) {
            this.article = navParams.get('selectedArticle');
            this.db_articles = [navParams.get('selectedArticle')];
        } else {
            this.db_articles = this.sqliteProvider.findAll('article');
        }
    }

    articleChange(event: { component: IonicSelectableComponent, value: any }) {
        this.article = event.value;
    }

    searchArticle(event: { component: IonicSelectableComponent, text: string }) {
        let text = event.text.trim();
        event.component.startSearch();
        event.component.items = this.sqliteProvider.findByElement('article', 'reference', text);
        event.component.endSearch();
    }

    addArticle() {
        if (this.article) {
            let numberOfArticles = 0;
            if (this.articles) {
                this.articles.forEach((articleToCmp) => {
                    if (articleToCmp.reference === this.article.reference) {
                        numberOfArticles++;
                    }
                });
            }
            this.sqliteProvider.keyExists(this.article.reference).then((value) => {
                if (value !== false) {
                    if (value > numberOfArticles) {
                        if (typeof (this.articles) !== 'undefined') {
                            this.articles.push(this.article);
                        } else {
                            this.articles = [this.article];
                        }
                        this.navCtrl.push(DeposeArticlesPageTraca, {articles: this.articles, emplacement: this.emplacement});
                    } else {
                        this.showToast('Cet article est déjà enregistré assez de fois dans le panier.');
                    }
                } else {
                    this.showToast('Cet article ne correspond à aucune prise.');
                }
            });
        } else {
            this.showToast("Cet article n'existe pas en stock.");
        }
    };


    async showToast(msg) {
        const toast = await this.toastController.create({
            message: msg,
            duration: 2000,
            position: 'center',
            cssClass: 'toast-error'
        });
        toast.present();
    }

}
