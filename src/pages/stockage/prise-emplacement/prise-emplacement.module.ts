import {NgModule} from '@angular/core';
import {IonicPageModule} from 'ionic-angular';
import {PriseEmplacementPage} from './prise-emplacement';
import {BarcodeScanner} from '@ionic-native/barcode-scanner';
import { IonicSelectableModule } from 'ionic-selectable'

@NgModule({
    declarations: [
        PriseEmplacementPage,
    ],
    imports: [
        IonicSelectableModule,
        IonicPageModule.forChild(PriseEmplacementPage),
    ],
    providers: [
        BarcodeScanner
    ]
})
export class PriseEmplacementPageModule {
}
