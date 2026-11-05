// Pure job eligibility computation with dry-run support.
// No DOM access, no chrome extension APIs, fail-closed design.
// Can be executed in browser context or in Node.js unit tests.

import { resolveLoadoutRequirement, normSpecs } from './loadout-resolver.js';
import { FALLBACK_PATH_MAP } from './server-map.js';

export function extractRequiredDecryptPower(job) {
    if (!job) return 0;
    if (typeof job.requiredDecryptPower === 'number') return job.requiredDecryptPower;
    if (job.conditions) {
        var items = Array.isArray(job.conditions) ? job.conditions : (job.conditions.items || []);
        for (var i = 0; i < items.length; i++) {
            var c = items[i];
            if (c.type === 'DecryptFile' || c.type === 'DecryptDownloadedFile') {
                if (c.requiredPower) return c.requiredPower;
                if (c.decryptPower) return c.decryptPower;
                if (c.details && c.details.files && c.details.files.length > 0) {
                    var f = c.details.files[0];
                    if (f.requiredPower || f.decryptPower || f.power) {
                        return f.requiredPower || f.decryptPower || f.power;
                    }
                }
            }
        }
    }
    return 0;
}

export function extractTargetFileType(job) {
    if (!job) return null;
    if (job.fileType) return job.fileType;
    if (job.conditions) {
        var items = Array.isArray(job.conditions) ? job.conditions : (job.conditions.items || []);
        for (var i = 0; i < items.length; i++) {
            var c = items[i];
            if ((c.type === 'DecryptFile' || c.type === 'DecryptDownloadedFile') && c.details && c.details.files && c.details.files.length > 0) {
                var f = c.details.files[0];
                var name = f.name || f.fileName || '';
                var match = name.match(/\.([a-z0-9]+)$/i);
                if (match) return match[1].toLowerCase();
                if (f.fileType) return f.fileType;
            }
        }
    }
    return null;
}

export function jobConditionsRequireDecrypt(job) {
    if (!job || !job.conditions) return false;
    var items = Array.isArray(job.conditions) ? job.conditions : (job.conditions.items || []);
    for (var i = 0; i < items.length; i++) {
        var t = items[i].type;
        if (t === 'DecryptFile' || t === 'DecryptDownloadedFile') return true;
    }
    return false;
}

export function evaluateTransitPath(targetServerName, serverMap, loadout, playerState) {
    var path = null;
    if (serverMap && typeof serverMap.getPathForServerName === 'function') {
        path = serverMap.getPathForServerName(targetServerName);
    }
    if (!path && FALLBACK_PATH_MAP[targetServerName]) {
        path = FALLBACK_PATH_MAP[targetServerName];
    }
    if (!path || path.length === 0) {
        return { ok: false, reason: 'No known path to server ' + targetServerName };
    }

    var activeAccess = (playerState && playerState.activeAccesses) || {};

    // Check intermediate hops (all hops before the target server)
    for (var i = 0; i < path.length - 1; i++) {
        var hop = path[i];
        var hopName = hop.name;
        var hopId = hop.id;

        // Check maintenance on intermediate hop
        if (serverMap && serverMap._servers && serverMap._servers[hopId]?.isInMaintenance) {
            return { ok: false, reason: 'Transit hop ' + hopName + ' is currently in maintenance' };
        }

        // If player already has access on this intermediate hop, no hack needed
        var hasAccess = activeAccess[hopName] || activeAccess[hopId];
        if (hasAccess) continue;

        // Check required defence rate / hack power for intermediate hop
        var hopDefenceRate = hop.defenceRate || (serverMap && serverMap._servers && serverMap._servers[hopId]?.defenceRate) || 0;
        if (hopDefenceRate > 0 && loadout) {
            var hopTypeName = hop.serverTypeName || (serverMap && serverMap._servers && serverMap._servers[hopId]?.typeName) || null;
            var reqResult = resolveLoadoutRequirement(loadout, {
                abilityType: 'HACK',
                targetPower: hopDefenceRate,
                serverTypeName: hopTypeName
            });
            if (!reqResult.achievableWithOwned.meetsTarget) {
                return {
                    ok: false,
                    reason: 'Intermediate transit server ' + hopName + ' requires Hack ' + hopDefenceRate +
                        ', but best achievable with owned hardware is ' + reqResult.achievableWithOwned.power,
                    hop: hopName,
                    requiredPower: hopDefenceRate,
                    achievablePower: reqResult.achievableWithOwned.power
                };
            }
        }
    }

    return { ok: true, path: path };
}

/**
 * Pure job eligibility evaluator.
 * Returns { status: 'eligible' | 'ineligible' | 'unknown' | 'manual-review', reasons: string[], details: object }
 */
export function checkJobEligibility(job, context) {
    context = context || {};
    var reasons = [];
    var details = {};

    // 1. Fail-closed on missing, null, or malformed job
    if (!job || typeof job !== 'object' || (!job.id && !job.jobId) || job.malformed || job.corrupted) {
        return {
            status: 'unknown',
            reasons: ['Malformed, missing, or corrupt job descriptor'],
            details: { job: job }
        };
    }

    // 2. Already signed / duplicate execution protection (can be allowed when evaluating solvability of in-progress jobs)
    if ((job.alreadyTaken || job.status === 'TAKEN' || job.status === 'running') && !context.allowTaken) {
        return {
            status: 'ineligible',
            reasons: ['Job is already accepted/taken; duplicate execution prevented'],
            details: { jobId: job.id || job.jobId }
        };
    }

    // 3. Expiration guard
    var now = context.currentTime || Date.now();
    var bufferMs = (context.config && typeof context.config.timeBufferMs === 'number') ? context.config.timeBufferMs : 60000;
    var expiresAt = job.expiresAt ? new Date(job.expiresAt).getTime() : (job.deadline ? new Date(job.deadline).getTime() : null);
    if (job.isExpired || (expiresAt !== null && (expiresAt - now < bufferMs))) {
        var remainingSec = expiresAt !== null ? Math.round((expiresAt - now) / 1000) : 0;
        return {
            status: 'ineligible',
            reasons: ['Job expires in ' + remainingSec + 's, within configured safety buffer of ' + Math.round(bufferMs / 1000) + 's'],
            details: { expiresAt: expiresAt, remainingSec: remainingSec, bufferMs: bufferMs }
        };
    }

    // 4. Cash reserve protection
    var deposit = job.deposit || 0;
    var playerCredits = context.playerState && typeof context.playerState.credits === 'number' ? context.playerState.credits : Infinity;
    var cashReserve = (context.config && typeof context.config.cashReserve === 'number') ? context.config.cashReserve :
                      (context.playerState && typeof context.playerState.cashReserve === 'number') ? context.playerState.cashReserve : 7200;
    if (deposit > 0 && playerCredits !== Infinity && (playerCredits - deposit < cashReserve)) {
        return {
            status: 'ineligible',
            reasons: ['Pledge of ' + deposit + ' CR would reduce credits (' + playerCredits + ' CR) below reserve of ' + cashReserve + ' CR'],
            details: { deposit: deposit, credits: playerCredits, reserve: cashReserve }
        };
    }

    // 5. Access Grant contracts: grant only issued upon signing
    var isAccessGrant = job.isAccessGrant || job.type === 'Access Grant' || (job.name && job.name.indexOf('Access Grant') >= 0);
    if (isAccessGrant) {
        return {
            status: 'manual-review',
            reasons: ['Access Grant contract on target: access is only created upon signing; requires manual review'],
            details: { isAccessGrant: true }
        };
    }

    // 6. Server and maintenance checks
    var serverName = job.serverName || (job.relatedServers && job.relatedServers[0] && job.relatedServers[0].serverName);
    var serverId = job.serverId || (job.relatedServers && job.relatedServers[0] && job.relatedServers[0].id);

    if (context.serverMap && context.serverMap.checkPathMaintenance) {
        var maint = context.serverMap.checkPathMaintenance(serverName || serverId);
        if (maint && maint.blocked) {
            return {
                status: 'ineligible',
                reasons: ['Target server or connecting path is currently in maintenance (' + (maint.blockerName || 'server') + ')'],
                details: maint
            };
        }
    }
    if (job.inMaintenance || (context.serverInMaintenance && (context.serverInMaintenance[serverName] || context.serverInMaintenance[serverId]))) {
        return {
            status: 'ineligible',
            reasons: ['Target server ' + (serverName || serverId) + ' is currently in maintenance'],
            details: { server: serverName || serverId }
        };
    }

    // 7. Transit path hackability (e.g. S4L1 behind E1SCP)
    if (serverName && serverName !== 'None') {
        var transitCheck = evaluateTransitPath(serverName, context.serverMap, context.loadout, context.playerState);
        if (!transitCheck.ok) {
            return {
                status: 'ineligible',
                reasons: [transitCheck.reason],
                details: transitCheck
            };
        }
    }

    // 8. Decrypt requirement checks
    var needsDecrypt = jobConditionsRequireDecrypt(job) || job.requiresDecrypt || (job.type && job.type.indexOf('Decrypt') >= 0);
    if (needsDecrypt && context.loadout) {
        var reqDecrypt = extractRequiredDecryptPower(job);
        var fileType = extractTargetFileType(job);
        var decryptResult = resolveLoadoutRequirement(context.loadout, {
            abilityType: 'DECRYPT',
            targetPower: reqDecrypt,
            fileType: fileType,
            catalogHardware: context.catalogHardware
        });
        details.decrypt = decryptResult;
        if (!decryptResult.achievableWithOwned.meetsTarget) {
            return {
                status: 'ineligible',
                reasons: [decryptResult.reason],
                details: details
            };
        }
    }

    // 9. Target server hack check
    var needsHack = job.requiresHack || (job.type && (job.type === 'IP Injection' || job.type === 'Log Deletion'));
    if (needsHack && context.loadout && serverName && serverName !== 'None') {
        var hasActiveAccess = context.playerState?.activeAccesses && (context.playerState.activeAccesses[serverName] || context.playerState.activeAccesses[serverId]);
        if (!hasActiveAccess) {
            var targetDefenceRate = job.serverDefenceRate || (context.serverDefenceRates && context.serverDefenceRates[serverName]) || 0;
            if (targetDefenceRate > 0) {
                var hackResult = resolveLoadoutRequirement(context.loadout, {
                    abilityType: 'HACK',
                    targetPower: targetDefenceRate,
                    serverTypeName: job.serverTypeName || null,
                    catalogHardware: context.catalogHardware
                });
                details.hack = hackResult;
                if (!hackResult.achievableWithOwned.meetsTarget) {
                    return {
                        status: 'ineligible',
                        reasons: [hackResult.reason],
                        details: details
                    };
                }
            }
        }
    }

    return {
        status: 'eligible',
        reasons: ['Job meets all safety, connectivity, power, and reserve criteria'],
        details: details
    };
}
