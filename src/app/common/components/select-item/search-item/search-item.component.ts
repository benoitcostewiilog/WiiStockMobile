import {ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {IonicSelectableComponent} from 'ionic-selectable';
import {SelectItemTypeEnum} from '@app/common/components/select-item/select-item-type.enum';
import {SqliteService} from '@app/common/services/sqlite/sqlite.service';
import {map, take, tap} from 'rxjs/operators';
import {ArticleInventaire} from '@entities/article-inventaire';
import {Observable, of, ReplaySubject, Subscription} from 'rxjs';


@Component({
    selector: 'wii-search-item',
    templateUrl: 'search-item.component.html',
    styleUrls: ['./search-item.component.scss']
})
export class SearchItemComponent implements OnInit, OnDestroy {

    private static readonly LENGTH_TO_LOAD: number = 30;

    public _item: any;

    @Input()
    public type: SelectItemTypeEnum;

    @Input()
    public requestParams?: Array<string> = [];

    @Input()
    public elements?: Array<{ id: string|number; label: string; }>;

    @Input()
    public isMultiple?: boolean = false;

    @Output()
    public itemChange: EventEmitter<any>;

    @Output()
    public itemsLoaded: EventEmitter<void>;

    @ViewChild('itemComponent', {static: false})
    public itemComponent: IonicSelectableComponent;

    public dbItemsForList: Array<any>;

    private dbItems: Array<any>;

    private lastSearch: string;

    private itemsSubscription: Subscription;

    public readonly config = {
        default: {
            label: 'label',
            valueField: 'id',
            templateIndex: 'default',
            placeholder: 'Sélectionner un élément'
        },
        [SelectItemTypeEnum.ARTICLE_TO_PICK]: {
            label: 'barcode',
            valueField: 'barcode',
            templateIndex: 'article-prepa',
            databaseTable: 'article_prepa_by_ref_article',
            placeholder: 'Sélectionner l\'article'
        },
        [SelectItemTypeEnum.LOCATION]: {
            label: 'label',
            valueField: 'id',
            templateIndex: 'default',
            databaseTable: 'emplacement',
            placeholder: 'Sélectionner un emplacement'
        },
        [SelectItemTypeEnum.TRACKING_NATURES]: {
            label: 'label',
            valueField: 'id',
            templateIndex: 'default',
            databaseTable: 'nature',
            placeholder: 'Sélectionner une nature'
        },
        [SelectItemTypeEnum.INVENTORY_LOCATION]: SearchItemComponent.MakeMapForInventoryLocations(false),
        [SelectItemTypeEnum.INVENTORY_ARTICLE]: SearchItemComponent.MakeMapForInventoryArticles(false),
        [SelectItemTypeEnum.INVENTORY_ANOMALIES_LOCATION]: SearchItemComponent.MakeMapForInventoryLocations(true),
        [SelectItemTypeEnum.INVENTORY_ANOMALIES_ARTICLE]: SearchItemComponent.MakeMapForInventoryArticles(true),
        [SelectItemTypeEnum.DEMANDE_LIVRAISON_TYPE]: {
            label: 'label',
            valueField: 'id',
            templateIndex: 'default',
            databaseTable: 'demande_livraison_type',
            placeholder: 'Sélectionner un type'
        },
        [SelectItemTypeEnum.DEMANDE_LIVRAISON_ARTICLES]: {
            label: 'bar_code',
            valueField: 'bar_code',
            templateIndex: 'article-demande',
            databaseTable: 'demande_livraison_article',
            placeholder: 'Sélectionner un article'
        },
        [SelectItemTypeEnum.STATUS]: {
            label: 'label',
            valueField: 'id',
            templateIndex: 'default',
            databaseTable: 'status',
            placeholder: 'Sélectionner un statut'
        }
    }

    public constructor(private sqliteService: SqliteService,
                       private changeDetector: ChangeDetectorRef) {
        this.itemChange = new EventEmitter<any>();
        this.itemsLoaded = new EventEmitter<void>();
        this.dbItemsForList = [];
        this.dbItems = [];
        this.lastSearch = '';
    }

    private static MakeMapForInventoryLocations(anomalyMode: boolean) {
        return {
            label: 'label',
            valueField: 'id',
            templateIndex: 'default',
            databaseTable: anomalyMode ? '`anomalie_inventaire`' : '`article_inventaire`',
            placeholder: 'Sélectionner un emplacement',
            map: (list: Array<ArticleInventaire>) => {
                return list
                    .reduce((acc, {location}) => ([
                        ...acc,
                        ...(acc.findIndex(({label: locationAlreadySaved}) => (locationAlreadySaved === location)) === -1
                            ? [{label: location, id: location}]
                            : [])
                    ]), []);
            }
        };
    }

    private static MakeMapForInventoryArticles(anomalyMode: boolean) {
        return {
            label: 'barcode',
            valueField: 'barcode',
            templateIndex: 'article-inventory',
            databaseTable: anomalyMode ? '`anomalie_inventaire`' : '`article_inventaire`',
            placeholder: 'Sélectionner un article'
        };
    }

    public get dbItemsLength(): number {
        return this.dbItems
            ? this.dbItems.length
            : 0;
    }

    @Input('item')
    public set item(item: any) {
        if (this._item !== item
            && (
                !this._item
                || !item
                || item.label !== this._item.label
            )) {
            this._item = item;
        }
    }

    public get item(): any {
        return this._item;
    }

    public clear(): void {
        this.itemComponent.clear();
    }

    public ngOnInit(): void {
        this.itemsSubscription = this.reload().subscribe(() => {
            this.itemsLoaded.emit();
        })
    }

    public reload(): Observable<Array<any>> {
        const $res = new ReplaySubject<Array<any>>(1);
        (this.elements ? of(this.elements) : this.sqliteService.findBy(this.config[this.type].databaseTable, this.requestParams))
            .pipe(
                take(1),
                map((list) => {
                    const {map} = this.config[this.smartType] as {map: any};
                    return map
                        ? map(list)
                        : list;
                }),
                tap((list) => {
                    this.dbItems = list;
                    this.loadFirstItems();
                })
            )
            // fix reload call withoyt subscribing
            .subscribe(
                (list) => { $res.next(list); },
                (error) => { $res.error(error); },
                () => { $res.complete(); }
            );
        return $res;
    }

    public ngOnDestroy(): void {
        if (this.itemsSubscription) {
            this.itemsSubscription.unsubscribe();
            this.itemsSubscription = undefined;
        }
    }

    public loadMore(search?: string): void {
        const beginIndex = this.dbItemsForList.length;
        const endIndex = this.dbItemsForList.length + SearchItemComponent.LENGTH_TO_LOAD;

        const filter = search || this.lastSearch;

        this.dbItemsForList.push(
            ...this
                .itemFiltered(filter)
                .slice(beginIndex, endIndex)
        );
    }

    public onItemChange(value: { value: any }): void {
        this.item = value.value;
        this.itemChange.emit(this.item);
    }

    public onItemSearch({text}: { text: string }): void {
        this.itemComponent.showLoading();
        this.changeDetector.detectChanges();

        this.clearItemForList();
        this.applySearch(text);

        this.itemComponent.hideLoading();
        this.changeDetector.detectChanges();
    }

    public onInfiniteScroll(): void {
        this.itemComponent.showLoading();

        if (this.dbItemsForList.length === this.dbItems.length) {
            this.itemComponent.disableInfiniteScroll();
        }
        else {
            this.loadMore();
        }
        this.itemComponent.endInfiniteScroll();
        this.itemComponent.hideLoading();
    }

    public findItem(search: string|number, searchAttribute: string = this.config[this.type].label): any {
        return this.dbItems
            ? this.dbItems.find((element) => (
                (Number.isInteger(element[searchAttribute])
                    ? element[searchAttribute].toString()
                    : element[searchAttribute])  === search))
            : undefined;
    }

    public get smartType(): string|number {
        return this.type || 'default';
    }

    private applySearch(text: string = ''): void {
        if (text) {
            const trimmedText = text.trim();
            if (trimmedText) {
                if (trimmedText.length > 2) {
                    this.loadFirstItems(text);
                    this.lastSearch = text ? trimmedText : '';
                }
            }
            else {
                this.lastSearch = '';
                this.loadFirstItems();
            }
        }
        else {
            this.lastSearch = '';
            this.loadFirstItems();
        }
    }

    private clearItemForList(): void {
        this.dbItemsForList.splice(0, this.dbItemsForList.length)
    }

    private loadFirstItems(search?: string): void {
        this.clearItemForList();
        this.loadMore(search);
    }

    private itemFiltered(search: string): Array<any> {
        return search
            ? this.dbItems.filter((location) => location.label.toLowerCase().includes(search.toLowerCase()))
            : this.dbItems;
    }
}
