import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { apiInterceptor } from './app/core/interceptors/api.interceptor';

// Angular 21's default XHR backend supports real multipart upload progress.
bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection(), provideRouter(routes, withComponentInputBinding()), provideHttpClient(withInterceptors([apiInterceptor]))]
}).catch(error => console.error(error));
