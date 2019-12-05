import {Component, EventEmitter, Input, Output} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import {Observable} from "rxjs";
import {map} from "rxjs/operators";

/**
 * Step to add svg icon into assets/icons :
 *  * Into svg file : remove all id except id on svg tag
 *  * Rename style classes declaration: .svg-[filename]-[oldClassName] ; exemple for icon.svg        .st0 -> .svg-icon-st0
 *  * on each element add svg-fill or svg-stroke (required to change color with component)
 */
@Component({
    selector: 'wii-icon',
    templateUrl: 'icon.component.html'
})
export class IconComponent {

    private static readonly ICONS_DIRECTORY: string = 'assets/icons';
    private static IconCounter: number = 0;

    // color declared in variables.scss
    @Input()
    public color?: 'primary'|'secondary'|'danger'|'light'|'dark'|'grey'|'green'|'white';

    @Output()
    public action: EventEmitter<any>;

    public svgObject$: Observable<SafeHtml>;

    private _name: string;

    private readonly id: number;

    private readonly domParser: DOMParser;

    public constructor(private httpClient: HttpClient,
                       private sanitizer: DomSanitizer) {
        this.id = ++IconComponent.IconCounter;
        this.action = new EventEmitter<any>();
        this.domParser = new DOMParser();
    }

    @Input()
    public set name(name: string) {
        if (this._name !== name) {
            this._name = name;
            this.svgObject$ = this.httpClient
                .get(this.src, {responseType: "text"})
                .pipe(map((svgStr: string) => {
                    if(!this.isSvg(svgStr)) {
                        throw Error('IconComponent support svg images only.');
                    }
                    return this.sanitizeSVG(svgStr);
                }));
        }
    }

    public onButtonClick(event: Event) {
        this.action.emit(event)
    }

    public get src(): string {
        return `${IconComponent.ICONS_DIRECTORY}/${this._name}`;
    }

    private sanitizeSVG(svgStr: string): SafeHtml {
        const cleanedSvg = this.cleanSVG(svgStr);
        const svgHTML = this.domParser.parseFromString(cleanedSvg, 'text/html');
        const children = svgHTML.body.children;
        for(let childIndex = 0; childIndex < children.length; childIndex++) {
            const svg = children.item(childIndex);
            svg.setAttribute('id', `wii-icon-${this.id}`);
        }
        return this.sanitizer.bypassSecurityTrustHtml(svgHTML.body.innerHTML);
    }

    private isSvg(iconStr: string): boolean {
        return iconStr.includes('<?xml') && iconStr.includes('<svg');
    }

    private cleanSVG(svgStr: string): string {
        return svgStr
            .replace(/^.*<\?xml.*$/mg, "")
            .replace(/^.*<!--.*$/mg, "")
            .trim();
    }

}