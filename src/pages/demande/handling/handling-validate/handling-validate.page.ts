import {Component, ViewChild} from '@angular/core';
import {Handling} from '@entities/handling';
import {ToastService} from '@app/common/services/toast.service';
import {ApiService} from '@app/common/services/api.service';
import {Network} from '@ionic-native/network/ngx';
import {LoadingService} from '@app/common/services/loading.service';
import {SqliteService} from '@app/common/services/sqlite/sqlite.service';
import {NavService} from '@app/common/services/nav.service';
import {from, Observable, of, Subscription, zip} from 'rxjs';
import {PageComponent} from '@pages/page.component';
import {HeaderConfig} from '@app/common/components/panel/model/header-config';
import {FormPanelParam} from '@app/common/directives/form-panel/form-panel-param';
import {HandlingAttachment} from '@entities/handling-attachment';
import {FormPanelInputComponent} from '@app/common/components/panel/form-panel/form-panel-input/form-panel-input.component';
import {FormPanelCameraComponent} from '@app/common/components/panel/form-panel/form-panel-camera/form-panel-camera.component';
import {FormPanelSelectComponent} from '@app/common/components/panel/form-panel/form-panel-select/form-panel-select.component';
import {SelectItemTypeEnum} from '@app/common/components/select-item/select-item-type.enum';
import {FormPanelComponent} from '@app/common/components/panel/form-panel/form-panel.component';
import {FileService} from '@app/common/services/file.service';
import {flatMap, map, tap} from 'rxjs/operators';
import {FormViewerParam} from '@app/common/directives/form-viewer/form-viewer-param';
import {FormViewerAttachmentsComponent} from '@app/common/components/panel/form-panel/form-viewer-attachments/form-viewer-attachments.component';
import {FormPanelService} from '@app/common/services/form-panel.service';
import {FreeField, FreeFieldType} from '@entities/free-field';
import {Translation} from '@entities/translation';


@Component({
    selector: 'wii-handling-validate',
    templateUrl: './handling-validate.page.html',
    styleUrls: ['./handling-validate.page.scss'],
})
export class HandlingValidatePage extends PageComponent {
    @ViewChild('formPanelComponent', {static: false})
    public formPanelComponent: FormPanelComponent;

    public headerConfig: HeaderConfig;
    public bodyConfig: Array<FormPanelParam>;
    public detailsConfig: Array<FormViewerParam>;

    private handling: Handling;
    private handlingsTranslations: {[label: string]: string};

    private loadingElement: HTMLIonLoadingElement;
    private apiSubscription: Subscription;
    private dataSubscription: Subscription;

    private beginDate: Date;

    public constructor(private loadingService: LoadingService,
                       private network: Network,
                       private apiService: ApiService,
                       private toastService: ToastService,
                       private sqliteService: SqliteService,
                       private fileService: FileService,
                       private formPanelService: FormPanelService,
                       navService: NavService) {
        super(navService);
    }

    public ionViewWillEnter(): void {
        this.handling = this.currentNavParams.get('handling');
        this.beginDate = new Date();

        this.dataSubscription = this.dismissLoading()
            .pipe(
                flatMap(() => this.loadingService.presentLoading()),
                tap((loading) => {
                    this.loadingElement = loading;
                }),
                flatMap(() => zip(
                    this.sqliteService.findBy('handling_attachment', [`handlingId = ${this.handling.id}`]),
                    this.sqliteService.findBy('free_field', [`categoryType = '${FreeFieldType.HANDLING}'`]),
                    this.sqliteService.findBy('translations', [`menu LIKE 'services'`])
                )),

            )
            .subscribe(([handlingAttachment, freeFields, handlingsTranslations]: [Array<HandlingAttachment>, Array<FreeField>, Array<Translation>]) => {
                this.dismissLoading();
                this.handlingsTranslations = handlingsTranslations.reduce((acc, {label, translation}) => ({
                    ...acc,
                    [label]: translation
                }), {});

                this.refreshHeader(false);

                let freeFieldsValues = JSON.parse(this.handling.freeFields || '{}') || {};

                const sAttachmentLabel = handlingAttachment.length > 1 ? 's' : '';
                this.detailsConfig = handlingAttachment.length > 0
                    ? [
                        {
                            item: FormViewerAttachmentsComponent,
                            config: {
                                label: `Pièce${sAttachmentLabel} jointe${sAttachmentLabel}`,
                                value: handlingAttachment.map(({fileName, href}) => ({
                                    label: fileName,
                                    href
                                }))
                            }
                        }
                    ]
                    : [];

                this.bodyConfig = [
                    {
                        item: FormPanelSelectComponent,
                        config: {
                            label: 'Statut',
                            name: 'statusId',
                            inputConfig: {
                                required: true,
                                searchType: SelectItemTypeEnum.STATUS,
                                requestParams: [
                                    `category = 'service'`,
                                    `state = 'treated'`,
                                    `typeId = ${this.handling.typeId}`
                                ],
                            },
                            errors: {
                                required: 'Le statut de la demande est requis',
                            }
                        }
                    },
                    {
                        item: FormPanelInputComponent,
                        config: {
                            label: 'Commentaire',
                            name: 'comment',
                            inputConfig: {
                                type: 'text',
                                maxLength: '255',
                                required: true
                            },
                            errors: {
                                required: 'Votre commentaire est requis',
                                maxlength: 'Votre commentaire est trop long'
                            }
                        }
                    },
                    {
                        item: FormPanelCameraComponent,
                        config: {
                            label: 'Photo(s)',
                            name: 'photos',
                            inputConfig: {
                                multiple: true
                            }
                        }
                    },

                    ...(freeFields
                        .filter(({typeId}) => (typeId === this.handling.typeId))
                        .map(({id, ...freeField}) => (
                            this.formPanelService.createConfigFromFreeField(
                                {id, ...freeField},
                                freeFieldsValues[id],
                                'freeFields',
                                'edit'
                            )
                        ))
                        .filter(Boolean))
                ];
            });
    }

    public ionViewWillLeave(): void {
        if (this.apiSubscription) {
            this.apiSubscription.unsubscribe();
            this.apiSubscription = undefined;
        }
    }

    public onFormSubmit(): void {
        if (this.network.type !== 'none') {
            if (this.formPanelComponent.firstError) {
                this.toastService.presentToast(this.formPanelComponent.firstError);
            }
            else if (!this.apiSubscription) {
                const {statusId, comment, photos, freeFields} = this.formPanelComponent.values

                const endDate = new Date();

                const params = {
                    id: this.handling.id,
                    statusId,
                    comment,
                    freeFields: JSON.stringify(freeFields || {}),
                    treatmentDelay: Math.floor((endDate.getTime() - this.beginDate.getTime()) / 1000),
                    ...(
                        photos && photos.length
                            ? photos.reduce((acc: { [name: string]: File}, photoBase64: string, index: number) => {
                                const name = `photo_${index + 1}`;
                                return ({
                                    ...acc,
                                    [name]: this.fileService.createFile(
                                        photoBase64,
                                        FileService.SIGNATURE_IMAGE_EXTENSION,
                                        FileService.SIGNATURE_IMAGE_TYPE,
                                        name
                                    )
                                })
                            }, {})
                            : {}
                    )
                };

                this.apiSubscription = this.dismissLoading()
                    .pipe(
                        flatMap(() => this.loadingService.presentLoading('Sauvegarde de la demande de service...')),
                        tap((loading: HTMLIonLoadingElement) => {
                            this.loadingElement = loading;
                        }),
                        flatMap(() => this.apiService.requestApi('post', ApiService.POST_HANDLING, {params})),
                        flatMap((res) => (
                            res && res.success
                                ? zip(
                                    this.sqliteService.deleteBy('handling', [`id = ${this.handling.id}`]),
                                    this.sqliteService.deleteBy('handling_attachment', [`handlingId = ${this.handling.id}`])
                                )
                                    .pipe(map(() => res))
                                : of(res)
                        )),
                        flatMap((res) => this.dismissLoading().pipe(map(() => res))),

                    )
                    .subscribe(
                        ({success, message}) => {
                            this.unsubscribeApi();
                            if (success) {
                                this.navService.pop();
                                this.toastService.presentToast("La demande de service a bien été traitée.");
                            }
                            else {
                                this.toastService.presentToast(message || "Une erreur s'est produite.");
                            }
                        },
                        () => {
                            this.unsubscribeApi();
                            this.dismissLoading();
                            this.toastService.presentToast("Une erreur s'est produite.");
                        }
                    );
            }
        }
        else {
            this.toastService.presentToast('Vous devez être connecté à internet pour valider la demande.');
        }
    }

    public dismissLoading(): Observable<void> {
        return this.loadingElement
            ? from(this.loadingElement.dismiss()).pipe(tap(() => {
                this.loadingElement = undefined;
            }))
            : of(undefined);
    }

    public refreshHeader(opened: boolean = false) {
        const {
            number,
            requester,
            desiredDate,
            subject,
            carriedOutOperationCount,
            source,
            destination,
            typeLabel,
            comment,
            emergency,
            color
        } = this.handling;
        this.headerConfig = {
            title: `Demande ${number}`,
            collapsed: true,
            onToggle: (opened) => {
                this.refreshHeader(opened);
            },
            leftIcon: {
                color: 'success',
                name: 'people.svg',
                customColor: color
            },
            rightIcon: {
                name: opened ? 'eye-slash.svg' : 'eye.svg',
                color: 'medium',
                action: () => {
                    this.formPanelComponent.formHeaderComponent.toggleTitle();
                }
            },
            subtitle: [
                `Demandeur : ${requester || ''}`,
                `Date attendue : ${desiredDate || ''}`,
                `${this.handlingsTranslations['Objet'] || 'Objet'} : ${subject || ''}`,
                `${this.handlingsTranslations['Nombre d\'opération(s) réalisée(s)'] || 'Nombre d\'opération(s) réalisée(s)'} : ${carriedOutOperationCount || ''}`,
                `Source : ${source || ''}`,
                `Destination : ${destination || ''}`,
                `Type : ${typeLabel || ''}`,
                `Commentaire : ${comment || ''}`,
                emergency ? `Urgence : ${emergency || ''}` : undefined
            ].filter((item) => item)
        };
    }

    private unsubscribeApi(): void {
        if (this.apiSubscription) {
            this.apiSubscription.unsubscribe();
            this.apiSubscription = undefined;
        }
    }
}
