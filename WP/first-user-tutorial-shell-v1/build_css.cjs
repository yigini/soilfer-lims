const fs = require('fs');
const path = require('path');
const postcss = require(path.resolve(__dirname, '../../client/node_modules/postcss'));

const previewPath = path.resolve(__dirname, 'review-preview.html');
const cssOutPath = path.resolve(__dirname, '../../client/src/tutorial/tutorial.css');
const content = fs.readFileSync(previewPath, 'utf8');

const startTag = '<style>';
const endTag = '</style>';
const rawCss = content.substring(content.indexOf(startTag) + startTag.length, content.indexOf(endTag));

const root = postcss.parse(rawCss);

// Find :root and body to extract variables and base styles
let overlayDecls = [
    'position: fixed',
    'inset: 0',
    'z-index: 99998',
    'overflow-y: auto',
    'box-sizing: border-box'
];

root.walkRules(rule => {
    if (rule.selector === ':root') {
        rule.walkDecls(decl => {
            overlayDecls.push(`${decl.prop}: ${decl.value}`);
        });
        rule.remove();
    } else if (rule.selector === 'body') {
        rule.walkDecls(decl => {
            if (decl.prop !== 'margin') {
                overlayDecls.push(`${decl.prop}: ${decl.value}`);
            }
        });
        rule.remove();
    } else if (rule.selector === '*') {
        rule.selector = '#soilfer-tutorial-overlay, #soilfer-tutorial-overlay *';
    } else {
        rule.selectors = rule.selectors.map(s => {
            s = s.trim();
            if (!s) return s;
            if (s === '*') return '#soilfer-tutorial-overlay *';
            return '#soilfer-tutorial-overlay ' + s;
        });
    }
});

const overlayRule = `#soilfer-tutorial-overlay {\n  ${overlayDecls.join(';\n  ')};\n}\n`;

const finalCss = `/* Scoped SoilFER Tutorial Overlay Styles */\n` + overlayRule + root.toString();

fs.writeFileSync(cssOutPath, finalCss, 'utf8');
console.log('Successfully wrote', cssOutPath, 'length:', finalCss.length);
