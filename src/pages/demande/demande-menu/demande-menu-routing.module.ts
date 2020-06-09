import {NgModule} from '@angular/core';
import {Routes, RouterModule} from '@angular/router';

import {DemandeMenuPage} from './demande-menu.page';
import {CanLeaveGuard} from '@app/guards/can-leave/can-leave.guard';

const routes: Routes = [
    {
        path: '',
        component: DemandeMenuPage,
        canDeactivate: [CanLeaveGuard]
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class DemandeMenuPageRoutingModule {
    public static readonly PATH: string = 'demande-menu';
}
