import {NgModule} from '@angular/core';
import {Routes, RouterModule} from '@angular/router';

import {InventoryLocationsAnomaliesPage} from './inventory-locations-anomalies.page';
import {CanLeaveGuard} from '@app/guards/can-leave/can-leave.guard';

const routes: Routes = [
    {
        path: '',
        component: InventoryLocationsAnomaliesPage,
        canDeactivate: [CanLeaveGuard]
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class InventoryLocationsAnomaliesPageRoutingModule {
    public static readonly PATH: string = 'inventory-locations-anomalies';
}
