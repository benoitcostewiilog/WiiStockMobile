import {Component, ViewChild, Injectable} from '@angular/core';
import {Platform, MenuController, Nav} from 'ionic-angular';
import {MenuPage} from '@pages/menu/menu';
import {ConnectPage} from '@pages/connect/connect';
import {StatusBar} from '@ionic-native/status-bar';
import {SplashScreen} from '@ionic-native/splash-screen';
import {NetworkProvider} from '@providers/network/network';
import {Network} from '@ionic-native/network';
import {TracaMenuPage} from '@pages/traca/traca-menu/traca-menu';
import {PreparationMenuPage} from '@pages/preparation/preparation-menu/preparation-menu';
import {LivraisonMenuPage} from '@pages/livraison/livraison-menu/livraison-menu';
import {InventaireMenuPage} from '@pages/inventaire-menu/inventaire-menu';


@Injectable()
@Component({
    selector: 'wii-main',
    templateUrl: 'app.component.html'
})
export class AppComponent {
    @ViewChild(Nav)
    public nav: Nav;

    // make ConnectPage the root (or first) page
    public rootPage = ConnectPage;
    public pages: Array<{ title: string, component: any }>;

    public pageWithHeader: boolean;


    public constructor(public platform: Platform,
                       public menu: MenuController,
                       public statusBar: StatusBar,
                       public splashScreen: SplashScreen,
                       public networkProvider: NetworkProvider,
                       public network: Network) {
        this.initializeApp();

        // set our app's pages
        this.pages = [
            {title: 'Accueil', component: MenuPage},
            {title: 'Traça', component: TracaMenuPage},
            {title: 'Préparation', component: PreparationMenuPage},
            {title: 'Livraison', component: LivraisonMenuPage},
            {title: 'Inventaire', component: InventaireMenuPage}
        ];
    }

    public initializeApp() {
        this.platform.ready().then(() => {
            // Okay, so the platform is ready and our plugins are available.
            // Here you can do any higher level native things you might need.
            this.statusBar.styleDefault();
            this.splashScreen.hide();
            this.networkProvider.initializeNetworkEvents();
        });
    }
}
