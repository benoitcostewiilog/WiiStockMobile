import {Component, EventEmitter, ViewChild} from '@angular/core';
import {SelectItemComponent} from '@app/common/components/select-item/select-item.component';
import {SelectItemTypeEnum} from '@app/common/components/select-item/select-item-type.enum';
import {BarcodeScannerModeEnum} from '@app/common/components/barcode-scanner/barcode-scanner-mode.enum';
import {Network} from '@ionic-native/network/ngx';
import {ToastService} from '@app/common/services/toast.service';
import {NavService} from '@app/common/services/nav.service';
import {Emplacement} from '@entities/emplacement';
import {PrisePageRoutingModule} from '@pages/prise-depose/prise/prise-routing.module';
import {DeposePageRoutingModule} from '@pages/prise-depose/depose/depose-routing.module';
import {NewEmplacementPageRoutingModule} from '@pages/new-emplacement/new-emplacement-routing.module';
import {PageComponent} from '@pages/page.component';
import {StorageService} from '@app/common/services/storage/storage.service';

@Component({
    selector: 'wii-emplacement-scan',
    templateUrl: './emplacement-scan.page.html',
    styleUrls: ['./emplacement-scan.page.scss'],
})
export class EmplacementScanPage extends PageComponent {
    @ViewChild('selectItemComponent', {static: false})
    public selectItemComponent: SelectItemComponent;

    public readonly selectItemType = SelectItemTypeEnum.LOCATION;

    public fromDepose: boolean;
    public fromStock: boolean;

    public barcodeScannerMode: BarcodeScannerModeEnum;

    public resetEmitter$: EventEmitter<void>;

    public loading: boolean;
    public isDemoMode: boolean;

    public constructor(private network: Network,
                       private toastService: ToastService,
                       private storageService: StorageService,
                       navService: NavService) {
        super(navService);
        this.resetEmitter$ = new EventEmitter<void>();
        this.loading = true;
    }

    public ionViewWillEnter(): void {
        this.loading = true;
        this.storageService.isDemoMode().subscribe((isDemoMode) => {
            this.fromDepose = Boolean(this.currentNavParams.get('fromDepose'));
            this.fromStock = Boolean(this.currentNavParams.get('fromStock'));
            this.loading = false;
            this.isDemoMode = isDemoMode;

            this.resetEmitter$.emit();

            this.barcodeScannerMode = this.fromStock || !isDemoMode
                ? BarcodeScannerModeEnum.TOOL_SEARCH
                : BarcodeScannerModeEnum.TOOLS_FULL;

            if (this.selectItemComponent) {
                this.selectItemComponent.fireZebraScan();
            }
        });
    }

    public ionViewWillLeave(): void {
        if (this.selectItemComponent) {
            this.selectItemComponent.unsubscribeZebraScan();
        }
    }

    public createEmp(): void {
        this.testNetwork(() => {
            this.navService.push(NewEmplacementPageRoutingModule.PATH, {
                fromDepose: this.fromDepose,
                createNewEmp: (emplacement: Emplacement) => {
                    this.selectLocation(emplacement)
                }
            });
        });
    }

    public selectLocation(emplacement: Emplacement) {
        this.testNetwork(() => {
            const nextPagePath = this.fromDepose
                ? DeposePageRoutingModule.PATH
                : PrisePageRoutingModule.PATH;
            this.navService.push(nextPagePath, {
                emplacement: emplacement,
                fromStock: this.fromStock,
                finishAction: () => {
                    this.navService.pop();
                }
            });
        });
    }

    private testNetwork(callback: () => void): void {
        if (!this.fromStock || this.network.type !== 'none') {
            callback();
        }
        else {
            this.toastService.presentToast('Vous devez être connecté à internet pour valider un transfert de stock');
        }
    }
}
