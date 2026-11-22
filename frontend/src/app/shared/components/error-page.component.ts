import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from './icon.component';
@Component({ selector: 'app-error-page', imports: [RouterLink, IconComponent], template: '<section class="card error-page"><span class="icon-tile"><app-icon name="shield" /></span><h1>{{title()}}</h1><p>{{message()}}</p><a class="btn primary" [routerLink]="auth.home()">Return to dashboard</a></section>' })
export class ErrorPageComponent { readonly auth = inject(AuthService); readonly title = input('Page not found'); readonly message = input('The page you requested is not available.'); }
