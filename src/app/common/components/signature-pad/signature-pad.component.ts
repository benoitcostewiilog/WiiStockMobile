import {Component, ElementRef, Input, ViewChild} from '@angular/core';
import {SignaturePad} from 'angular2-signaturepad/signature-pad';
import {ModalController} from '@ionic/angular';


@Component({
    selector: 'wii-signature-pad',
    templateUrl: 'signature-pad.component.html',
    styleUrls: [
        './signature-pad.component.scss'
    ]
})
export class SignaturePadComponent {

    public signaturePadOption;

    @Input()
    public signature: string;

    @ViewChild('signatureWrapper', {static: false})
    public signatureWrapper: ElementRef;

    @ViewChild(SignaturePad, {static: false})
    public signaturePad: SignaturePad;

    public constructor(private modalController: ModalController) {
    }

    public ionViewWillEnter(): void {
        setTimeout(() => {
            const componentSize = this.signatureWrapper.nativeElement.getBoundingClientRect();
            console.log(componentSize)
            this.signaturePadOption = {
                canvasWidth: componentSize.width,
                canvasHeight: componentSize.height - 4,
                backgroundColor: 'rgb(255, 255, 255)',
                minWidth: 1
            };
            setTimeout(() => {
                this.signaturePad.fromDataURL(this.signature);
            });
        });
    }

    public onValidate(): void {
        this.modalController.dismiss({
            signature: this.signaturePad.isEmpty()
                ? false
                : this.signaturePad.toDataURL('image/jpeg')
        });
    }

    public onPop(): void {
        this.modalController.dismiss({});
    }

    public onClear(): void {
        this.signaturePad.clear();
    }

}