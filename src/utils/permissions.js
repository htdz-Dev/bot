const { PermissionFlagsBits } = require('discord.js');

/**
 * Check if user has admin permissions
 * @param {GuildMember} member - Discord guild member
 * @returns {boolean}
 */
function isAdmin(member) {
    if (!member) return false;

    return member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageGuild);
}

/**
 * Create permission denied message
 * @returns {string}
 */
function getPermissionDeniedMessage() {
    return '❌ ليس لديك صلاحية لاستخدام هذا الأمر. يتطلب صلاحيات المسؤول.';
}

module.exports = {
    isAdmin,
    getPermissionDeniedMessage
};
