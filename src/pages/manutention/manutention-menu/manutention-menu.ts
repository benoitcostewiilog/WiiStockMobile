import {Component, ViewChild} from '@angular/core';
import {Content, IonicPage, Navbar, NavController} from 'ionic-angular';
import {Manutention} from '@app/entities/manutention';
import {SqliteProvider} from '@providers/sqlite/sqlite';
import {MenuPage} from '@pages/menu/menu';
import {ManutentionValidatePage} from '@pages/manutention/manutention-validate/manutention-validate';


@IonicPage()
@Component({
    selector: 'page-manutention-menu',
    templateUrl: 'manutention-menu.html',
})
export class ManutentionMenuPage {
    @ViewChild(Navbar)
    public navBar: Navbar;

    @ViewChild(Content)
    public content: Content;

    public manutentions: Array<Manutention>;
    public hasLoaded: boolean;
    public user: string;

    public constructor(private navCtrl: NavController,
                       private sqliteProvider: SqliteProvider) {
    }

    public goHome(): void {
        this.navCtrl.setRoot(MenuPage);
    }

    public ionViewWillEnter(): void {
        this.synchronise();
    }

    public synchronise(): void {
        this.hasLoaded = false;
        this.sqliteProvider.findAll('`manutention`').subscribe((manutentions) => {
            this.manutentions = manutentions;
            this.sqliteProvider.getOperateur().then((userName) => {
                this.user = userName;
                this.hasLoaded = true;
                this.content.resize();
            });
        });
    }

    public goToManut(manutention: Manutention): void {
        this.navCtrl.push(ManutentionValidatePage, {manutention});
    }

    public toDate(manutention: Manutention): Date {
        return new Date(manutention.date_attendue);
    }
}
