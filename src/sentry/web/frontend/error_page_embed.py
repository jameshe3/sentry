from __future__ import absolute_import

from django import forms
from django.core.urlresolvers import reverse
from django.http import HttpResponse
from django.views.generic import View
from django.template.loader import render_to_string
from django.utils.safestring import mark_safe

from sentry.models import Group, ProjectKey, UserReport
from sentry.web.helpers import render_to_response
from sentry.utils import json
from sentry.utils.http import absolute_uri, is_valid_origin


class UserReportForm(forms.ModelForm):
    event_id = forms.CharField(max_length=32, widget=forms.HiddenInput)
    dsn = forms.CharField(max_length=128, widget=forms.HiddenInput)
    name = forms.CharField(max_length=128, widget=forms.TextInput(attrs={
        'placeholder': 'Jane Doe',
    }))
    email = forms.EmailField(max_length=75, widget=forms.TextInput(attrs={
        'placeholder': 'jane@example.com',
        'type': 'email',
    }))
    comments = forms.CharField(widget=forms.Textarea(attrs={
        'placeholder': "I clicked on 'X' and then hit 'Confirm'",
    }))

    class Meta:
        model = UserReport
        fields = ('name', 'email', 'comments', 'event_id')


class ErrorPageEmbedView(View):
    def _get_project_key(self, request):
        project_id = request.POST.get('project_id', request.GET.get('project_id'))
        public_key = request.POST.get('public_key', request.GET.get('public_key'))
        if not (project_id and public_key):
            return

        try:
            key = ProjectKey.objects.get(
                project=project_id,
                public_key=public_key,
            )
        except ProjectKey.DoesNotExist:
            return

        return key

    def _get_origin(self, request):
        return request.META.get('HTTP_ORIGIN', request.META.get('HTTP_REFERER'))

    def get(self, request):
        form = UserReportForm()

        template = render_to_string('sentry/error-page-embed.html', {
            'form': form,
        })

        context = {
            'endpoint': mark_safe(json.dumps(absolute_uri(reverse('sentry-error-page-embed')))),
            'template': mark_safe(json.dumps(template)),
        }

        return render_to_response('sentry/error-page-embed.js', context, request,
                                  content_type='text/javascript')

    def post(self, request):
        event_id = request.POST.get('event_id')
        if not event_id:
            return HttpResponse(status=404)

        key = self._get_project_key(request)
        if not key:
            return HttpResponse(status=404)

        origin = self._get_origin(request)
        if not origin:
            return HttpResponse(status=403)

        if not is_valid_origin(origin, key.project):
            return HttpResponse(status=403)

        form = UserReportForm(request.POST or None, initial={
            'project_id': key.project_id,
            'public_key': key.public_key,
            'event_id': event_id,
        })
        if form.is_valid():
            report = form.save(commit=False)
            report.project = key.project
            report.event_id = event_id
            try:
                report.group = Group.objects.get(
                    eventmapping__event_id=event_id,
                    eventmapping__project=key.project,
                )
            except Group.DoesNotExist:
                # XXX(dcramer): the system should fill this in later
                pass
            report.save()

        context = {
            'request': request,
            'form': form,
        }

        return render_to_response('sentry/error-page-embed.html', context, request)
