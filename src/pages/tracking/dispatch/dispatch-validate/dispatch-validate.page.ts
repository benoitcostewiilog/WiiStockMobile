import {Component, ViewChild} from '@angular/core';
import {Subscription, zip} from 'rxjs';
import {NavService} from '@app/common/services/nav.service';
import {PageComponent} from '@pages/page.component';
import {SqliteService} from '@app/common/services/sqlite/sqlite.service';
import {LoadingService} from '@app/common/services/loading.service';
import {filter, flatMap, tap} from 'rxjs/operators';
import {Dispatch} from '@entities/dispatch';
import {CardListColorEnum} from '@app/common/components/card-list/card-list-color.enum';
import {MainHeaderService} from '@app/common/services/main-header.service';
import {IconConfig} from '@app/common/components/panel/model/icon-config';
import {ToastService} from '@app/common/services/toast.service';
import {BarcodeScannerModeEnum} from '@app/common/components/barcode-scanner/barcode-scanner-mode.enum';
import {Emplacement} from '@entities/emplacement';
import {Status} from '@entities/status';
import {SelectItemComponent} from '@app/common/components/select-item/select-item.component';
import {SelectItemTypeEnum} from '@app/common/components/select-item/select-item-type.enum';
import {LocalDataManagerService} from '@app/common/services/local-data-manager.service';
import {DispatchPack} from '@entities/dispatch-pack';

enum Page {
    LOCATION,
    STATUS
}

@Component({
    selector: 'wii-dispatch-validate',
    templateUrl: './dispatch-validate.page.html',
    styleUrls: ['./dispatch-validate.page.scss'],
})
export class DispatchValidatePage extends PageComponent {

    public currentPage: Page = Page.LOCATION;
    public readonly PageLocation: Page = Page.LOCATION;
    public readonly PageStatus: Page = Page.STATUS;

    public readonly selectItemStatus = SelectItemTypeEnum.STATUS;
    public readonly selectItemLocation = SelectItemTypeEnum.LOCATION;
    public readonly barcodeScannerSearchMode = BarcodeScannerModeEnum.TOOL_SEARCH;

    public statusRequestParams;

    @ViewChild('locationSelectItemComponent', {static: false})
    public locationSelectItemComponent: SelectItemComponent;

    @ViewChild('statusSelectItemComponent', {static: false})
    public statusSelectItemComponent: SelectItemComponent;

    public loading: boolean;

    private loadingSubscription: Subscription;
    private loadingElement?: HTMLIonLoadingElement;

    private afterValidate: () => void;

    public locationHeaderConfig: {
        title: string;
        subtitle?: string;
        leftIcon: IconConfig;
        rightIcon: IconConfig;
        transparent: boolean;
    };

    public statusHeaderConfig: {
        title: string;
        subtitle?: string;
        leftIcon: IconConfig;
        rightIcon: IconConfig;
        transparent: boolean;
    };

    private selectedLocation: Emplacement;
    private selectedStatus: Status;
    private dispatch: Dispatch;
    private dispatchPacks: Array<DispatchPack>;

    public constructor(private sqliteService: SqliteService,
                       private loadingService: LoadingService,
                       private mainHeaderService: MainHeaderService,
                       private localDataManagerService: LocalDataManagerService,
                       private toastService: ToastService,
                       navService: NavService) {
        super(navService);
    }


    public ionViewWillEnter(): void {
        this.loading = true;
        this.unsubscribeLoading();
        const dispatchId = this.currentNavParams.get('dispatchId');
        this.dispatchPacks = this.currentNavParams.get('dispatchPacks');
        this.afterValidate = this.currentNavParams.get('afterValidate');

        this.loadingSubscription = this.loadingService.presentLoading()
            .pipe(
                tap((loader) => {
                    this.loadingElement = loader;
                }),
                flatMap(() => this.sqliteService.findOneBy('dispatch', {id: dispatchId})),
                filter((dispatch) => Boolean(dispatch))
            )
            .subscribe((dispatch: Dispatch) => {
                this.dispatch = dispatch;

                this.statusRequestParams = [`treated = 1`, `category = 'acheminement'`, `typeId = ${this.dispatch.typeId}`]

                this.refreshLocationHeaderConfig();
                this.refreshStatusHeaderConfig();

                this.unsubscribeLoading();
                this.loading = false;

                this.locationSelectItemComponent.fireZebraScan();
                this.statusSelectItemComponent.unsubscribeZebraScan();

                setTimeout(() => {
                    this.statusSelectItemComponent.searchComponent.reload();
                })
            });
    }


    public ionViewWillLeave(): void {
        this.unsubscribeLoading();
        this.locationSelectItemComponent.unsubscribeZebraScan();
        this.statusSelectItemComponent.unsubscribeZebraScan();
    }

    public selectLocation(location: Emplacement): void {
        if (this.dispatch.locationToLabel === location.label) {
            this.selectedLocation = location;
            this.refreshLocationHeaderConfig();
        }
        else {
            this.toastService.presentToast("Vous n'avez pas scanné le bon emplacement.")
        }
    }

    public selectStatus(status: Status): void {
        this.selectedStatus = status;
        this.refreshStatusHeaderConfig();
    }

    private unsubscribeLoading(): void {
        if (this.loadingSubscription) {
            this.loadingSubscription.unsubscribe();
            this.loadingSubscription = undefined;
        }
        if (this.loadingElement) {
            this.loadingElement.dismiss();
            this.loadingElement = undefined;
        }
    }

    private refreshLocationHeaderConfig(): void {
        this.locationHeaderConfig = {
            title: 'Emplacement sélectionné',
            subtitle: this.selectedLocation && this.selectedLocation.label,
            ...(this.createHeaderConfig())
        };
    }

    private refreshStatusHeaderConfig(): void {
        this.statusHeaderConfig = {
            title: 'Statut sélectionné',
            subtitle: this.selectedStatus && this.selectedStatus.label,
            ...(this.createHeaderConfig())
        };
    }

    private createHeaderConfig(): { leftIcon: IconConfig; rightIcon: IconConfig; transparent: boolean;} {
        return {
            transparent: true,
            leftIcon: {
                name: 'stock-transfer.svg',
                color: CardListColorEnum.GREEN
            },
            rightIcon: {
                name: 'check.svg',
                color: 'success',
                action: () => this.validate()
            }
        };
    }

    private validate() {
        if (this.currentPage === this.PageLocation) {
            if (this.selectedLocation) {
                this.currentPage = this.PageStatus;
                this.locationSelectItemComponent.unsubscribeZebraScan();
                this.statusSelectItemComponent.fireZebraScan();
            }
            else {
                this.toastService.presentToast('Vous devez sélectionner un emplacement.');
            }
        }
        else { // (this.currentPage === this.PageStatus)
            if (this.selectedStatus) {
                this.loadingSubscription = this.loadingService.presentLoading()
                    .pipe(
                        tap((loader) => {
                            this.loadingElement = loader;
                        }),
                        flatMap(() => zip(
                            this.sqliteService.update('dispatch', {treatedStatusId: this.selectedStatus.id}, [`id = ${this.dispatch.id}`]),
                            ...((this.dispatchPacks || []).map(({id, natureId, quantity}) => this.sqliteService.update('dispatch_pack', {natureId, quantity}, [`id = ${id}`])))
                        )),
                        flatMap(() => this.localDataManagerService.sendFinishedProcess('dispatch')),
                        flatMap(() => this.navService.pop())
                    )
                    .subscribe(() => {
                        this.afterValidate();
                    })
            }
            else {
                this.toastService.presentToast('Vous devez sélectionner un statut.');
            }
        }
    }
}