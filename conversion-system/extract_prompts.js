const { execSync } = require('child_process');

const commits = [
    'e87b7f7895f9d30c872bb53a2fdaeab23f767585',
    'a53c9c8a3e95295c690556a494b3def9be5112fa',
    '0c83c74d9ac91c2e78c0f461a374b665567bcb05',
    '5f6a04b8a1bc8f2f8e54609ec6b8dcefe85b6eb8',
    '12e60a733dc475f58c620023aed6d59ac9145d9f',
    '6f2424762f4a309efc94e7283627c824e117d660',
    '1e22a26fba4f6654cd8749c74386723ef92513d5'
];

const filePath = 'agent/salesBot.js';

console.log("# Historical SALES_IDENTITY_PROMPT Versions\n");

for (const commit of commits) {
    try {
        const content = execSync(`git show ${commit}:${filePath}`, { encoding: 'utf8', stdio: 'pipe' });

        // Regex to extract the prompt variable
        // Matches `const SALES_IDENTITY_PROMPT = \` ... \`;` across multiple lines
        const match = content.match(/const SALES_IDENTITY_PROMPT = `([\s\S]*?)`;/);

        if (match && match[1]) {
            console.log(`## Commit ${commit} (Latest first)`);
            console.log("```text");
            console.log(match[1].trim());
            console.log("```\n");
        } else {
            // Fallback for older versions if variable name was different, or just skips
            // console.log(`## Commit ${commit}: Prompt not found or format changed.\n`);
        }
    } catch (e) {
        console.log(`## Commit ${commit}: Error reading file (maybe didn't exist?)\n`);
    }
}
