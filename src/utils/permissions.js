const { PermissionFlagsBits } = require('discord.js');

// Roles authorized for admin commands
const ADMIN_ROLE_IDS = [
    '1324814862223802430',
    '1444749025265058044'
];

/**
 * Check if user has admin permissions or authorized role
 * @param {GuildMember} member - Discord guild member
 * @returns {boolean}
 */
function isAdmin(member) {
    if (!member) return false;

    // Check if has Administrator permission
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }

    // Check if has any of the authorized roles
    const hasAuthorizedRole = member.roles.cache.some(role =>
        ADMIN_ROLE_IDS.includes(role.id)
    );

    return hasAuthorizedRole;
}

/**
 * Create permission denied message
 * @returns {string}
 */
function getPermissionDeniedMessage() {
    return '❌ ليس لديك صلاحية لاستخدام هذا الأمر.\n❌ Vous n\'avez pas la permission d\'utiliser cette commande.';
}

module.exports = {
    isAdmin,
    getPermissionDeniedMessage
};
