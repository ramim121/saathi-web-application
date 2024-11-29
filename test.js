function generateNotificationBody(template, data) {
    // Get the template
    eval(`var template = \`${template}\``);
    return template;
}

console.log(generateNotificationBody('Hello ${data.name}', { name: 'John' }));