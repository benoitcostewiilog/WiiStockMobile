import {Injectable} from '@angular/core';
import {CanActivate, Router, UrlTree} from '@angular/router';
import {Observable, zip} from 'rxjs';
import {StorageService} from '@app/common/services/storage.service';
import {map} from 'rxjs/operators';


@Injectable({
    providedIn: 'root'
})
export class UserDisconnectedGuard implements CanActivate {

    public constructor(private storageService: StorageService,
                       private router: Router) {}

    public canActivate(): Observable<UrlTree|boolean> {
        return zip(
            this.storageService.getOperateur(),
            this.storageService.getApiKey()
        ).pipe(
            map(([operator, apiKey]) => (
                Boolean(!operator || !apiKey) || this.router.createUrlTree(['/main-menu'])
            ))
        );
    }

}