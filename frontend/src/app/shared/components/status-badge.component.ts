import { Component, input } from '@angular/core';
import { ClaimStatus } from '../../models/claims';
@Component({ selector: 'app-status', template: '<span [class]="\'badge status-\' + status()">{{ status() }}</span>' })
export class StatusBadgeComponent { readonly status = input.required<ClaimStatus>(); }
