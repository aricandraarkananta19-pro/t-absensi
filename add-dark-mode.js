const fs = require('fs');
const path = require('path');

const directoryPath = 'src';

const replacements = [
    // Backgrounds
    { regex: /\bbg-white\b(?! dark:)/g, rep: 'bg-white dark:bg-slate-900' },
    { regex: /\bbg-slate-50\b(?!(\/| dark:))/g, rep: 'bg-slate-50 dark:bg-slate-800' },
    { regex: /\bbg-slate-100\b(?!(\/| dark:))/g, rep: 'bg-slate-100 dark:bg-slate-800\/80' },
    { regex: /\bbg-slate-50\/50\b(?! dark:)/g, rep: 'bg-slate-50\/50 dark:bg-slate-800\/50' },
    { regex: /\bbg-slate-100\/50\b(?! dark:)/g, rep: 'bg-slate-100\/50 dark:bg-slate-800\/50' },
    { regex: /\bhover:bg-slate-50\b(?!(\/| dark:))/g, rep: 'hover:bg-slate-50 dark:hover:bg-slate-800' },
    { regex: /\bhover:bg-slate-100\b(?!(\/| dark:))/g, rep: 'hover:bg-slate-100 dark:hover:bg-slate-700' },

    // Text
    { regex: /\btext-slate-900\b(?! dark:)/g, rep: 'text-slate-900 dark:text-white' },
    { regex: /\btext-slate-800\b(?! dark:)/g, rep: 'text-slate-800 dark:text-slate-100' },
    { regex: /\btext-slate-700\b(?! dark:)/g, rep: 'text-slate-700 dark:text-slate-200' },
    { regex: /\btext-slate-600\b(?! dark:)/g, rep: 'text-slate-600 dark:text-slate-300' },
    { regex: /\btext-slate-500\b(?! dark:)/g, rep: 'text-slate-500 dark:text-slate-400' },

    // Borders
    { regex: /\bborder-slate-200\b(?!(\/| dark:))/g, rep: 'border-slate-200 dark:border-slate-700' },
    { regex: /\bborder-slate-100\b(?!(\/| dark:))/g, rep: 'border-slate-100 dark:border-slate-800' },
    { regex: /\bborder-slate-200\/50\b(?! dark:)/g, rep: 'border-slate-200\/50 dark:border-slate-700\/50' },
    { regex: /\bborder-slate-100\/80\b(?! dark:)/g, rep: 'border-slate-100\/80 dark:border-slate-800\/80' },
];

function processPath(p) {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
        fs.readdirSync(p).forEach(f => processPath(path.join(p, f)));
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
        if (['EnterpriseLayout.tsx', 'KaryawanWorkspaceLayout.tsx', 'KaryawanDashboardNew.tsx', 'ThemeContext.tsx', 'MobileDashboardView.tsx', 'AbsensiKaryawan.tsx'].includes(path.basename(p))) {
            return;
        }
        let content = fs.readFileSync(p, 'utf8');
        let original = content;

        replacements.forEach(({ regex, rep }) => {
            content = content.replace(regex, rep);
        });

        if (original !== content) {
            fs.writeFileSync(p, content);
            console.log(`Updated: ${p}`);
        }
    }
}

processPath(directoryPath);
