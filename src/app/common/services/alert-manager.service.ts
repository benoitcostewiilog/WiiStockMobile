import {Injectable} from "@angular/core";


@Injectable({
    providedIn: 'root'
})
export class AlertManagerService {

    public static readonly CSS_CLASS_MANAGED_ALERT = 'custom-managed-alert';

    /**
     * Disable autocapitalize on all input in all alert with CSS_CLASS_MANAGED_ALERT
     */
    public disableAutocapitalizeOnAlert(): void {
        const inputs = document.querySelectorAll(`ion-alert.${AlertManagerService.CSS_CLASS_MANAGED_ALERT} input`);
        inputs.forEach((input: Element) => {
            input.setAttribute('autocapitalize', 'off');
        });
    }

    /**
     * Replace "\n" by <br/> in message
     */
    public breakMessageLines(): void {
        const inputs = document.querySelectorAll(`ion-alert.${AlertManagerService.CSS_CLASS_MANAGED_ALERT} .alert-message`);
        inputs.forEach((element: Element) => {
            element.innerHTML = element.innerHTML.replace(/\n/g, "<br/>");
        });
    }
}
