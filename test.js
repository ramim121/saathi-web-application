let fs = require('fs');

function generateNotificationBody(template, data) {
    // Get the template
    eval(`var template = \`${template}\``);
    return template;
}

console.log(generateNotificationBody(fs.readFileSync('./src/notifications/email_templates/signup_completion.html', 'utf8'), { fullName: 'John' }));