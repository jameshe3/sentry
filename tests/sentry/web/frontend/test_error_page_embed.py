from __future__ import absolute_import

from django.core.urlresolvers import reverse
from uuid import uuid4

from sentry.models import UserReport
from sentry.testutils import TestCase


class ErrorPageEmbedTest(TestCase):
    urls = 'sentry.conf.urls'

    def setUp(self):
        super(ErrorPageEmbedTest, self).setUp()
        self.project = self.create_project()
        self.key = self.create_project_key(self.project)
        self.event_id = uuid4().hex

    def test_renders(self):
        path = '%s?project_id=%s&public_key=%s&event_id=%s' % (
            reverse('sentry-error-page-embed'),
            self.project.id,
            self.key.public_key,
            self.event_id,
        )

        resp = self.client.get(path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/error-page-embed.html')

    def test_submission(self):
        path = reverse('sentry-error-page-embed')

        resp = self.client.post(path, {
            'project_id': self.project.id,
            'public_key': self.key.public_key,
            'event_id': self.event_id,
            'name': 'Jane Doe',
            'email': 'jane@example.com',
            'comments': 'This is an example!',
        })
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/error-page-embed-success.html')

        report = UserReport.objects.get()
        assert report.name == 'Jane Doe'
        assert report.email == 'jane@example.com'
