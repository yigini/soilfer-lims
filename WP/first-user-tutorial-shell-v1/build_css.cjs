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
    'z-index: 8500',
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

const dockedStyles = `
/* Docked guide styles (step >= 1 over real application pages) */
#soilfer-tutorial-overlay.docked {
  inset: auto 24px 24px auto !important;
  top: auto !important;
  left: auto !important;
  right: 24px !important;
  bottom: 24px !important;
  width: 440px !important;
  max-width: calc(100vw - 48px) !important;
  max-height: 88vh !important;
  background: transparent !important;
  pointer-events: none !important;
  overflow: visible !important;
  z-index: 8500 !important;
}

#soilfer-tutorial-overlay.docked > * {
  pointer-events: auto;
}

#soilfer-tutorial-overlay.docked .coach {
  position: static !important;
  width: 100% !important;
  max-height: 85vh !important;
  overflow-y: auto !important;
  box-shadow: 0 16px 36px rgba(34, 55, 42, 0.22) !important;
}

@media (max-width: 600px) {
  #soilfer-tutorial-overlay.docked {
    left: 10px !important;
    right: 10px !important;
    bottom: 10px !important;
    width: auto !important;
    max-width: calc(100vw - 20px) !important;
  }
}

/* Target element highlight on real pages */
.sf-tutorial-target-highlight {
  outline: 3px solid #245942 !important;
  outline-offset: 4px !important;
  box-shadow: 0 0 0 8px rgba(36, 89, 66, 0.25) !important;
  transition: outline 0.2s ease, box-shadow 0.2s ease;
  animation: sf-tutorial-pulse 2s infinite ease-in-out;
}

@keyframes sf-tutorial-pulse {
  0% {
    box-shadow: 0 0 0 4px rgba(36, 89, 66, 0.35);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(36, 89, 66, 0.15);
  }
  100% {
    box-shadow: 0 0 0 4px rgba(36, 89, 66, 0.35);
  }
}
`;

const overlayRule = `#soilfer-tutorial-overlay {\n  ${overlayDecls.join(';\n  ')};\n}\n`;

const finalCss = `/* Scoped SoilFER Tutorial Overlay Styles */\n` + overlayRule + root.toString() + dockedStyles;

fs.writeFileSync(cssOutPath, finalCss, 'utf8');
console.log('Successfully wrote', cssOutPath, 'length:', finalCss.length);
