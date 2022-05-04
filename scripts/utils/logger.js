const util = require('util');
// const fs = require('fs');
const os = require('os');
const { network } = require('hardhat');
const Sentry = require('@sentry/node');

// const log_file = fs.createWriteStream(log_path, { flags: 'w' });

const CLI_COLORS = {
  Reset: '\x1b[0m',
  Bright: '\x1b[1m',
  Dim: '\x1b[2m',
  Underscore: '\x1b[4m',
  Blink: '\x1b[5m',
  Reverse: '\x1b[7m',
  Hidden: '\x1b[8m',

  FgBlack: '\x1b[30m',
  FgRed: '\x1b[31m',
  FgGreen: '\x1b[32m',
  FgYellow: '\x1b[33m',
  FgBlue: '\x1b[34m',
  FgMagenta: '\x1b[35m',
  FgCyan: '\x1b[36m',
  FgWhite: '\x1b[37m',

  BgBlack: '\x1b[40m',
  BgRed: '\x1b[41m',
  BgGreen: '\x1b[42m',
  BgYellow: '\x1b[43m',
  BgBlue: '\x1b[44m',
  BgMagenta: '\x1b[45m',
  BgCyan: '\x1b[46m',
  BgWhite: '\x1b[47m',
}

function log(color, title, ...d) {
  let line = '';
  for (const l of d) {
    line += util.format(l) + ' ';
  }

  process.stdout.write(`${color}${dateF()} ${title} ${line}${CLI_COLORS.Reset}\n`);
  // log_file.write('ERROR: ' + line + '\n');
}

console.log = console.debug = function(...d) {
  // let line = ' ';
  let line_color = ' ';
  for (const l of d) {
    if (typeof l == 'string') {
      // line += l + ' ';
      line_color += l + ' ';
      continue;
    }

    const formated = util.format(l);
    // line += formated + ' ';
    line_color += ' ' + CLI_COLORS.FgGreen + formated + CLI_COLORS.Reset;
  }

  process.stdout.write(dateF() + line_color + '\n');
  // log_file.write(line + '\n');
  sendSentry('debug', ...d);
};

console.done = function(...d) {
  // log(CLI_COLORS.FgGreen, '✓ DONE:', ...d);
  log(CLI_COLORS.FgGreen, '✓', ...d);
  sendSentry('info', ...d);
};
console.info = function(...d) {
  log(CLI_COLORS.FgBlue, 'ⓘ INFO:', ...d);
  sendSentry('info', ...d);
};
console.warning = console.warn = function(...d) {
  log(CLI_COLORS.FgYellow, '⚠ WARN:', ...d);
  sendSentry('warning', ...d);
};

console.error = function(...d) {
  log(CLI_COLORS.FgRed, '✖ ERROR:', ...d);
  sendSentry('error', ...d);
};

console.crit = console.fatal = console.critical = function(...d) {
  log(CLI_COLORS.FgRed + CLI_COLORS.Bright, '✖ FATAL:', ...d);
  sendSentry('fatal', ...d);
};

console.blink = function(...d) {
  log(CLI_COLORS.Blink, '', ...d);
};
console.inline = function(...d) {
  let line = '';
  for (const l of d) {
    line += util.format(l) + ' ';
  }

  process.stdout.write(`${dateF()} ${line}`);
};

console.clear = function() {
  process.stdout.write('\r\x1b[K');
  process.stdout.write('');
}


function dateF() {
  return new Date().toLocaleString();
}

const sentryConf = network.config.sentry;
const sentryEnabled = sentryConf && sentryConf.dsn;

function sendSentry(level, ...data) {
  if (!sentryEnabled) return;
  if (!sentryConf.levels.includes(level)) return;

  const message = typeof data[0] == 'string' ? data[0] : data.message || JSON.stringify(data);

  if (['warning', 'error', 'fatal'].includes(level)) {
    const last = data[data.length - 1];
    const err = last instanceof Error
      ? last
      : data[0] instanceof Error
        ? data[0]
        : new Error(message);

    if (err.message.length > 50) {
      err.messageFull = err.message;
      err.message = err.message.substring(0, 48) + '..';
    }

    return Sentry.captureException(err, {
      level,
      extra: data,
      message: err.message,
    });
  }

  return Sentry.captureMessage(message, {
    level,
    extra: data,
  });
}

process.beforeQuit = async () => console.warn('Quit');

process.quit = () => {
  process.beforeQuit();

  if (!sentryEnabled) return process.exit();

  Sentry.close(2000).then(function() {
    process.exit();
  });
}

if (!sentryEnabled) return console.warn('Sentry disable');
else console.log('Sentry enabled');

Sentry.init({
  dsn: sentryConf.dsn,
  environment: network.name,
  serverName: os.hostname(),
  debug: false,
});
