(function(window){
  'use strict';

  var template = {{ template }};
  var endpoint = {{ endpoint }};
  var options = window.sentryConfig;

  if (!options.element) {
    options.element = 'sentry_error_embed';
  }

  var element = document.getElementById(options.element);

  if (!element) {
    console.error('[Sentry] Unable to find container #' + options.element);
    return;
  }

  element.innerHTML = template;

  var form = element.getElementsByTagName('form')[0];
}(window));
