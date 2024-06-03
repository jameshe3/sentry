import round from 'lodash/round';

import {t} from 'sentry/locale';
import type {CommitAuthor, User} from 'sentry/types';
import {RATE_UNIT_LABELS, RateUnit} from 'sentry/utils/discover/fields';
import {formatFloat} from 'sentry/utils/number/formatFloat';

export function userDisplayName(user: User | CommitAuthor, includeEmail = true): string {
  let displayName = String(user?.name ?? t('Unknown author')).trim();

  if (displayName.length <= 0) {
    displayName = t('Unknown author');
  }

  const email = String(user?.email ?? '').trim();

  if (email.length > 0 && email !== displayName && includeEmail) {
    displayName += ' (' + email + ')';
  }
  return displayName;
}

// in milliseconds
export const MONTH = 2629800000;
export const WEEK = 604800000;
export const DAY = 86400000;
export const HOUR = 3600000;
export const MINUTE = 60000;
export const SECOND = 1000;
export const MILLISECOND = 1;
export const MICROSECOND = 0.001;
export const NANOSECOND = 0.000001;

/**
 * @deprecated Import directly from `sentry/utils/duration/getExactDuration` instead.
 * biome-ignore lint/performance/noBarrelFile: Temporary for getsentry
 */
export {getExactDuration} from 'sentry/utils/duration/getExactDuration';

export function formatSecondsToClock(
  seconds: number,
  {padAll}: {padAll: boolean} = {padAll: true}
) {
  if (seconds === 0 || isNaN(seconds)) {
    return padAll ? '00:00' : '0:00';
  }

  const divideBy = (msValue: number, time: number) => {
    return {
      quotient: msValue < 0 ? Math.ceil(msValue / time) : Math.floor(msValue / time),
      remainder: msValue % time,
    };
  };

  // value in milliseconds
  const absMSValue = round(Math.abs(seconds * 1000));

  const {quotient: hours, remainder: rMins} = divideBy(absMSValue, HOUR);
  const {quotient: minutes, remainder: rSeconds} = divideBy(rMins, MINUTE);
  const {quotient: secs, remainder: milliseconds} = divideBy(rSeconds, SECOND);

  const fill = (num: number) => (num < 10 ? `0${num}` : String(num));

  const parts = hours
    ? [padAll ? fill(hours) : hours, fill(minutes), fill(secs)]
    : [padAll ? fill(minutes) : minutes, fill(secs)];

  const ms = `000${milliseconds}`.slice(-3);
  return milliseconds ? `${parts.join(':')}.${ms}` : parts.join(':');
}

export function parseClockToSeconds(clock: string) {
  const [rest, milliseconds] = clock.split('.');
  const parts = rest.split(':');

  let seconds = 0;
  const progression = [MONTH, WEEK, DAY, HOUR, MINUTE, SECOND].slice(parts.length * -1);
  for (let i = 0; i < parts.length; i++) {
    const num = Number(parts[i]) || 0;
    const time = progression[i] / 1000;
    seconds += num * time;
  }
  const ms = Number(milliseconds) || 0;
  return seconds + ms / 1000;
}

/**
 * Format a value between 0 and 1 as a percentage
 */
export function formatPercentage(
  value: number,
  places: number = 2,
  options: {
    minimumValue?: number;
  } = {}
) {
  if (value === 0) {
    return '0%';
  }

  const minimumValue = options.minimumValue ?? 0;

  if (Math.abs(value) <= minimumValue) {
    return `<${minimumValue * 100}%`;
  }

  return (
    round(value * 100, places).toLocaleString(undefined, {
      maximumFractionDigits: places,
    }) + '%'
  );
}

const numberFormatSteps = [
  [1_000_000_000, 'b'],
  [1_000_000, 'm'],
  [1_000, 'k'],
] as const;

/**
 * Formats a number with an abbreviation e.g. 1000 -> 1k.
 *
 * @param number the number to format
 * @param maximumSignificantDigits the number of significant digits to include
 * @param includeDecimals when true, formatted number will always include non trailing zero decimal places
 */
export function formatAbbreviatedNumber(
  number: number | string,
  maximumSignificantDigits?: number,
  includeDecimals?: boolean
): string {
  number = Number(number);

  const prefix = number < 0 ? '-' : '';
  const numAbsValue = Math.abs(number);

  for (const step of numberFormatSteps) {
    const [suffixNum, suffix] = step;
    const shortValue = Math.floor(numAbsValue / suffixNum);
    const fitsBound = numAbsValue % suffixNum === 0;

    if (shortValue <= 0) {
      continue;
    }

    const useShortValue = !includeDecimals && (shortValue > 10 || fitsBound);

    if (useShortValue) {
      if (maximumSignificantDigits === undefined) {
        return `${prefix}${shortValue}${suffix}`;
      }
      const formattedNumber = parseFloat(
        shortValue.toPrecision(maximumSignificantDigits)
      ).toString();
      return `${prefix}${formattedNumber}${suffix}`;
    }

    const formattedNumber = formatFloat(
      numAbsValue / suffixNum,
      maximumSignificantDigits || 1
    ).toLocaleString(undefined, {
      maximumSignificantDigits,
    });

    return `${prefix}${formattedNumber}${suffix}`;
  }

  return number.toLocaleString(undefined, {maximumSignificantDigits});
}

/**
 * Formats a number with an abbreviation and rounds to 2
 * decimal digits without forcing trailing zeros.
 * e. g. 1000 -> 1k, 1234 -> 1.23k
 */
export function formatAbbreviatedNumberWithDynamicPrecision(
  value: number | string
): string {
  const number = Number(value);

  if (number === 0) {
    return '0';
  }

  const log10 = Math.log10(Math.abs(number));
  // numbers less than 1 will have a negative log10
  const numOfDigits = log10 < 0 ? 1 : Math.floor(log10) + 1;

  const maxStep = numberFormatSteps[0][0];

  // if the number is larger than the largest step, we determine the number of digits
  // by dividing the number by the largest step, otherwise the number of formatted
  // digits is the number of digits in the number modulo 3 (the number of zeroes between steps)
  const numOfFormattedDigits =
    number > maxStep
      ? Math.floor(Math.log10(number / maxStep))
      : Math.max(numOfDigits % 3 === 0 ? 3 : numOfDigits % 3, 0);

  const maximumSignificantDigits = numOfFormattedDigits + 2;

  return formatAbbreviatedNumber(value, maximumSignificantDigits, true);
}

/**
 * Rounds to specified number of decimal digits (defaults to 2) without forcing trailing zeros
 * Will preserve significant decimals for very small numbers
 * e.g. 0.0001234 -> 0.00012
 * @param value number to format
 */
export function formatNumberWithDynamicDecimalPoints(
  value: number,
  maxFractionDigits = 2
): string {
  if ([0, Infinity, -Infinity, NaN].includes(value)) {
    return value.toLocaleString();
  }

  const exponent = Math.floor(Math.log10(Math.abs(value)));

  const maximumFractionDigits =
    exponent >= 0 ? maxFractionDigits : Math.abs(exponent) + 1;
  const numberFormat = {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  };

  return value.toLocaleString(undefined, numberFormat);
}

export function formatRate(
  value: number,
  unit: RateUnit = RateUnit.PER_SECOND,
  options: {
    minimumValue?: number;
    significantDigits?: number;
  } = {}
) {
  // NOTE: `Intl` doesn't support unitless-per-unit formats (i.e.,
  // `"-per-minute"` is not valid) so we have to concatenate the unit manually, since our rates are usually just "/min" or "/s".
  // Because of this, the unit is not internationalized.

  // 0 is special!
  if (value === 0) {
    return `${0}${RATE_UNIT_LABELS[unit]}`;
  }

  const minimumValue = options.minimumValue ?? 0;
  const significantDigits = options.significantDigits ?? 3;

  const numberFormatOptions: ConstructorParameters<typeof Intl.NumberFormat>[1] = {
    notation: 'compact',
    compactDisplay: 'short',
    minimumSignificantDigits: significantDigits,
    maximumSignificantDigits: significantDigits,
  };

  if (value <= minimumValue) {
    return `<${minimumValue}${RATE_UNIT_LABELS[unit]}`;
  }

  return `${value.toLocaleString(undefined, numberFormatOptions)}${
    RATE_UNIT_LABELS[unit]
  }`;
}

export function formatSpanOperation(
  operation?: string,
  length: 'short' | 'long' = 'short'
) {
  if (length === 'long') {
    return getLongSpanOperationDescription(operation);
  }

  return getShortSpanOperationDescription(operation);
}

function getLongSpanOperationDescription(operation?: string) {
  if (operation?.startsWith('http')) {
    return t('URL request');
  }

  if (operation === 'db.redis') {
    return t('cache query');
  }

  if (operation?.startsWith('db')) {
    return t('database query');
  }

  if (operation?.startsWith('task')) {
    return t('application task');
  }

  if (operation?.startsWith('serialize')) {
    return t('serializer');
  }

  if (operation?.startsWith('middleware')) {
    return t('middleware');
  }

  if (operation === 'resource') {
    return t('resource');
  }

  if (operation === 'resource.script') {
    return t('JavaScript file');
  }

  if (operation === 'resource.css') {
    return t('stylesheet');
  }

  if (operation === 'resource.img') {
    return t('image');
  }

  return t('span');
}

function getShortSpanOperationDescription(operation?: string) {
  if (operation?.startsWith('http')) {
    return t('request');
  }

  if (operation?.startsWith('db')) {
    return t('query');
  }

  if (operation?.startsWith('task')) {
    return t('task');
  }

  if (operation?.startsWith('serialize')) {
    return t('serializer');
  }

  if (operation?.startsWith('middleware')) {
    return t('middleware');
  }

  if (operation?.startsWith('resource')) {
    return t('resource');
  }

  return t('span');
}
