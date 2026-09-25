/**
 * Assembles the 45s short-cut marketing video from the recorded footage
 * (no VO/music yet — captions + real product footage only, per plan).
 * Each beat is rendered to its own segment file, then concatenated.
 */
const path = require('path')
const fs = require('fs')
const { execFileSync } = require('child_process')

const DIR = __dirname
const SEG = path.join(DIR, 'segments')
const CAP = path.join(DIR, 'captions')
const FF = 'C:/Users/vishw/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe'
const FONT = 'C:/Windows/Fonts/segoeuib.ttf'

const MAIN = path.join(DIR, 'page@80b7449abac25de0478ee6ddba727e59.webm')
const LANG = path.join(DIR, 'page@d207fc7eb92e9776924c6e948866d80e.webm')

const W = 1920, H = 1080
const BG = '0x0B1220'

// ffmpeg filter args need forward slashes, an escaped drive-letter colon,
// AND single-quote wrapping (verified empirically — escaping alone or
// quoting alone both fail to parse on this ffmpeg build).
function ffPath(p) {
  return "'" + p.replace(/\\/g, '/').replace(/:/g, '\\:') + "'"
}

function writeCaption(name, text) {
  const p = path.join(CAP, name + '.txt')
  fs.writeFileSync(p, text)
  return p
}

function run(args) {
  execFileSync(FF, args, { stdio: 'inherit' })
}

// Footage segment: crop from source, scale/pad to 1920x1080, burn in a
// bottom caption bar.
function footageSeg(name, { src, inPoint, duration, crop, caption }) {
  const out = path.join(SEG, name + '.mp4')
  const capFile = writeCaption(name, caption)
  const vf = []
  if (crop) vf.push(`crop=${crop}`)
  vf.push(`scale=${W}:${H}:force_original_aspect_ratio=decrease`)
  vf.push(`pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG}`)
  vf.push('setsar=1', 'fps=30')
  vf.push(`drawbox=x=0:y=${H - 200}:w=${W}:h=200:color=black@0.55:t=fill`)
  vf.push(`drawbox=x=0:y=${H - 200}:w=${W}:h=3:color=#38BDF8:t=fill`)
  vf.push(`drawtext=fontfile=${ffPath(FONT)}:textfile=${ffPath(capFile)}:fontcolor=white:fontsize=54:line_spacing=14:x=(w-text_w)/2:y=${H - 130}:box=0`)
  run(['-y', '-ss', String(inPoint), '-i', src, '-t', String(duration), '-vf', vf.join(','), '-an', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', out])
  return out
}

// Pure text/color segment (hook, problem, pricing, CTA).
function textSeg(name, { duration, caption, fontsize = 64, sub, subFontsize = 34 }) {
  const out = path.join(SEG, name + '.mp4')
  const capFile = writeCaption(name, caption)
  const vf = [
    `drawtext=fontfile=${ffPath(FONT)}:textfile=${ffPath(capFile)}:fontcolor=white:fontsize=${fontsize}:line_spacing=18:x=(w-text_w)/2:y=(h-text_h)/2${sub ? '-40' : ''}:box=0`,
  ]
  if (sub) {
    const subFile = writeCaption(name + '-sub', sub)
    vf.push(`drawtext=fontfile=${ffPath(FONT)}:textfile=${ffPath(subFile)}:fontcolor=#38BDF8:fontsize=${subFontsize}:x=(w-text_w)/2:y=(h/2)+90:box=0`)
  }
  run(['-y', '-f', 'lavfi', '-i', `color=c=${BG}:s=${W}x${H}:d=${duration}:r=30`, '-vf', vf.join(','), '-an', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', out])
  return out
}

// Two footage sub-clips back-to-back within one beat (e.g. inventory+reports).
function footageDuo(name, a, b) {
  const segA = footageSeg(name + 'A', a)
  const segB = footageSeg(name + 'B', b)
  return [segA, segB]
}

const segments = []

segments.push(textSeg('01-hook', {
  duration: 3,
  caption: "Running a business shouldn't need\n5 different apps that don't talk to each other.",
  fontsize: 56,
}))

segments.push(textSeg('02-problem', {
  duration: 5,
  caption: 'Billing app. Inventory app.\nStaff app. Reports app.',
  sub: "None of them talk to each other.",
  fontsize: 58,
}))

segments.push(footageSeg('03-reveal', {
  src: MAIN, inPoint: 16.5, duration: 4.0,
  crop: '1140:270:300:280',
  caption: 'Meet Sarang — one offline business OS.',
}))

segments.push(textSeg('03b-pivot', {
  duration: 1.8,
  caption: "Here's what your day looks like.",
  fontsize: 50,
}))

segments.push(footageSeg('04-billing', {
  src: MAIN, inPoint: 22.0, duration: 5.5,
  crop: '730:125:300:395',
  caption: 'Bill a sale in seconds.',
}))

const invRep = footageDuo('05-invrep',
  { src: MAIN, inPoint: 29.0, duration: 3, crop: null, caption: 'Inventory, staff, reports —' },
  { src: MAIN, inPoint: 35.0, duration: 3, crop: null, caption: 'updated automatically.' },
)
segments.push(...invRep)

segments.push(footageSeg('06-offline', {
  src: MAIN, inPoint: 40.0, duration: 4.0,
  crop: null,
  caption: 'Works with zero internet.\nYour data never leaves your computer.',
}))

const vertLang = footageDuo('07-vertlang',
  { src: MAIN, inPoint: 45.5, duration: 2.5, crop: null, caption: '50 business types.' },
  { src: LANG, inPoint: 16.0, duration: 2.5, crop: null, caption: '13 languages.' },
)
segments.push(...vertLang)

segments.push(textSeg('08-pricing', {
  duration: 5,
  caption: '₹6,999/year',
  sub: 'Free for the first 100 days.',
  fontsize: 84,
}))

segments.push(textSeg('09-cta', {
  duration: 4,
  caption: 'Download free',
  sub: 'aszurex.com/sarang',
  fontsize: 72,
}))

// Crossfade assembly (premium feel — hard cuts read as a screen recording,
// not an ad) + a global fade in/out bookend.
const FFPROBE = FF.replace('ffmpeg.exe', 'ffprobe.exe')
function probeDuration(file) {
  const out = execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file])
  return parseFloat(out.toString().trim())
}

const XFADE = 0.4
const durations = segments.map(probeDuration)

const inputArgs = []
segments.forEach((s) => { inputArgs.push('-i', s) })

let filter = ''
let cum = durations[0]
let lastLabel = '0:v'
for (let i = 1; i < segments.length; i++) {
  const offset = Math.max(0, cum - XFADE)
  const outLabel = `v${i}`
  filter += `[${lastLabel}][${i}:v]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}[${outLabel}];`
  lastLabel = outLabel
  cum = cum + durations[i] - XFADE
}
const totalDur = cum
filter += `[${lastLabel}]fade=t=in:st=0:d=0.5,fade=t=out:st=${(totalDur - 0.6).toFixed(3)}:d=0.6[vout]`

const outFinal = path.join(DIR, 'sarang-marketing-short-45s.mp4')
run(['-y', ...inputArgs, '-filter_complex', filter, '-map', '[vout]', '-an', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', outFinal])
console.log('DONE:', outFinal, 'duration~', totalDur.toFixed(1) + 's')
