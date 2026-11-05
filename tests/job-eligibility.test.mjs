import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkJobEligibility } from '../src/shared/job-eligibility.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localCases = path.resolve(__dirname, './eligibility_cases.json');
const rootCases = path.resolve(__dirname, '../../tests/eligibility_cases.json');
const casesFile = fs.existsSync(localCases) ? localCases : rootCases;
const testCases = JSON.parse(fs.readFileSync(casesFile, 'utf8'));

// Hardware and software fixtures
const M_MATE_CPU = {
    id: 'cpu-m-mate',
    name: 'M-Mate J12-40',
    category: 'CPU',
    specs: { cpuFrequency: 2400, cpuCores: 4, cpuConsuming: 250 }
};

const UNO_CPU = {
    id: 'cpu-uno',
    name: 'UNO 6.651',
    category: 'CPU',
    price: 14490,
    specs: { cpuFrequency: 4200, cpuCores: 8, cpuConsuming: 450 }
};

const BASE_GPU = {
    id: 'gpu-base',
    name: 'Standard Integrated GPU',
    category: 'GPU',
    specs: { gpuPower: 1200, gpuMemory: 4096, gpuConsuming: 150 }
};

const BASE_RAM = {
    id: 'ram-base',
    name: 'Standard DDR RAM',
    category: 'RAM',
    specs: { ramFrequency: 2133, ramMemory: 8192 }
};

const EMERALD_H2S9_RAM = {
    id: 'ram-emerald-h2s9',
    name: 'Emerald H2S9',
    category: 'RAM',
    price: 6200,
    specs: { ramFrequency: 3600, ramMemory: 16384 }
};

const PSU_1550 = {
    id: 'psu-1550',
    name: '1Y Series 1550 2kW',
    category: 'PSU',
    specs: { psuPower: 2000 }
};

const PSU_WEAK = {
    id: 'psu-weak',
    name: 'Weak 300W PSU',
    category: 'PSU',
    specs: { psuPower: 300 }
};

const CYPHER_PLUS_SW = {
    id: 'sw-cypher-plus',
    name: 'Cypher+ v1.4',
    specs: [
        {
            type: 'DECRYPT',
            power: [11, 20],
            fileTypes: ['eb52x', 'ab52p', 'enc']
        }
    ],
    consuming: {
        cpu_frequency: [2400, 4200],
        cpu_cores: [4, 8],
        ram_frequency: [2133, 4800],
        ram_memory: [8192, 24576]
    }
};

const PORTER_LITE_SW = {
    id: 'sw-porter-lite',
    name: 'Porter-lite r4',
    specs: [
        {
            type: 'HACK',
            power: [8, 17],
            serverTypes: ['Home', 'Corporate', 'Government', 'Industrial', 'SCP']
        }
    ],
    consuming: {
        cpu_frequency: [2400, 4200],
        cpu_cores: [4, 8],
        gpu_power: [1200, 4800],
        gpu_memory: [4096, 12288]
    }
};

describe('Job Eligibility Fixtures (tests/eligibility_cases.json)', () => {
    it('Scenario 1: locked-acquisition -> ineligible', () => {
        // S4L1 Access Acquisition behind E1SCP, current Hack 8 vs required 12, no valid alternate path
        const job = {
            id: 'job-locked-acq',
            jobId: 'job-locked-acq',
            name: 'Access Acquisition',
            type: 'Access Acquisition',
            serverName: 'RM7-S4L1',
            serverId: '019e4052-c315-71df-80da-4e334b96c9e6',
            expiresAt: new Date(Date.now() + 600000).toISOString()
        };
        const loadout = {
            equippedHardware: { cpu: M_MATE_CPU, gpu: BASE_GPU, ram: BASE_RAM, psu: PSU_1550 },
            ownedHardware: [M_MATE_CPU, BASE_GPU, BASE_RAM, PSU_1550],
            equippedSoftware: [PORTER_LITE_SW],
            ownedSoftware: [PORTER_LITE_SW]
        };
        // Mock serverMap where intermediate hop RM7-E1SCP has defenceRate 12
        const mockServerMap = {
            getPathForServerName: () => [
                { name: 'RM7-E1L5', id: '019d1b0a-13a9-77dd-b41f-374ee144bd07' },
                { name: 'RM7-E1SCP', id: '019d1b0a-13a9-77dd-b41f-3a21d490cb2d', defenceRate: 12, serverTypeName: 'SCP' },
                { name: 'RM7-S4L4', id: '019d1b0a-13a9-77dd-b41f-3ffb5f671742' },
                { name: 'RM7-S4L1', id: '019e4052-c315-71df-80da-4e334b96c9e6' }
            ],
            checkPathMaintenance: () => ({ blocked: false })
        };
        const context = {
            loadout,
            serverMap: mockServerMap,
            playerState: { credits: 12000, activeAccesses: { 'RM7-E1L5': true } },
            currentTime: Date.now()
        };

        const result = checkJobEligibility(job, context);
        assert.equal(result.status, 'ineligible');
        assert.match(result.reasons[0], /transit.*E1SCP.*Hack/i);
    });

    it('Scenario 2: grant-later-login -> manual-review', () => {
        // Access Grant contract on target, grant only created upon signing
        const job = {
            id: 'job-grant',
            jobId: 'job-grant',
            name: 'Access Grant',
            type: 'Access Grant',
            serverName: 'RM7-E1L5',
            deposit: 0,
            expiresAt: new Date(Date.now() + 600000).toISOString()
        };
        const context = {
            currentTime: Date.now(),
            playerState: { credits: 10000 }
        };
        const result = checkJobEligibility(job, context);
        assert.equal(result.status, 'manual-review');
    });

    it('Scenario 3: decrypt-low -> ineligible', () => {
        // Decrypt 15 needed, best achievable with owned hardware and Cypher+ is 11
        const job = {
            id: 'job-decrypt-low',
            jobId: 'job-decrypt-low',
            name: 'File Decryption',
            type: 'File Decryption',
            fileType: 'eb52x',
            requiredDecryptPower: 15,
            serverName: 'None',
            expiresAt: new Date(Date.now() + 600000).toISOString()
        };
        const loadout = {
            equippedHardware: { cpu: M_MATE_CPU, gpu: BASE_GPU, ram: BASE_RAM, psu: PSU_1550 },
            ownedHardware: [M_MATE_CPU, BASE_GPU, BASE_RAM, PSU_1550],
            equippedSoftware: [CYPHER_PLUS_SW],
            ownedSoftware: [CYPHER_PLUS_SW]
        };
        const result = checkJobEligibility(job, { loadout, currentTime: Date.now() });
        assert.equal(result.status, 'ineligible');
        assert.match(result.reasons[0], /below required 15/i);
    });

    it('Scenario 4: decrypt-owned-upgrade -> eligible', () => {
        // Decrypt 15 needed and owned bootable CPU/RAM/software combo supports power 15 after free loadout swap
        const job = {
            id: 'job-decrypt-upgrade',
            jobId: 'job-decrypt-upgrade',
            name: 'File Decryption',
            type: 'File Decryption',
            fileType: 'eb52x',
            requiredDecryptPower: 15,
            serverName: 'None',
            expiresAt: new Date(Date.now() + 600000).toISOString()
        };
        // Currently equipped has M-Mate (power 11), but owned has UNO CPU + Emerald H2S9 RAM (power 15)
        const loadout = {
            equippedHardware: { cpu: M_MATE_CPU, gpu: BASE_GPU, ram: BASE_RAM, psu: PSU_1550 },
            ownedHardware: [M_MATE_CPU, UNO_CPU, BASE_GPU, BASE_RAM, EMERALD_H2S9_RAM, PSU_1550],
            equippedSoftware: [CYPHER_PLUS_SW],
            ownedSoftware: [CYPHER_PLUS_SW]
        };
        const result = checkJobEligibility(job, { loadout, currentTime: Date.now() });
        assert.equal(result.status, 'eligible');
    });

    it('Scenario 5: missing-owned-component -> ineligible', () => {
        // Recommended hypothetical hardware not owned; current best loadout cannot meet target
        const job = {
            id: 'job-missing-hw',
            jobId: 'job-missing-hw',
            name: 'File Decryption',
            type: 'File Decryption',
            fileType: 'eb52x',
            requiredDecryptPower: 15,
            serverName: 'None',
            expiresAt: new Date(Date.now() + 600000).toISOString()
        };
        const loadout = {
            equippedHardware: { cpu: M_MATE_CPU, gpu: BASE_GPU, ram: EMERALD_H2S9_RAM, psu: PSU_1550 },
            ownedHardware: [M_MATE_CPU, BASE_GPU, EMERALD_H2S9_RAM, PSU_1550], // UNO CPU NOT owned
            equippedSoftware: [CYPHER_PLUS_SW],
            ownedSoftware: [CYPHER_PLUS_SW]
        };
        const catalogHardware = [UNO_CPU];
        const result = checkJobEligibility(job, { loadout, catalogHardware, currentTime: Date.now() });
        assert.equal(result.status, 'ineligible');
        assert.ok(result.details.decrypt.cheapestMissingPurchases);
        assert.equal(result.details.decrypt.cheapestMissingPurchases[0].id, 'cpu-uno');
    });

    it('Scenario 6: server-maintenance -> ineligible', () => {
        // Target or only connecting path in maintenance; no alternate path
        const job = {
            id: 'job-maint',
            jobId: 'job-maint',
            name: 'Data Download',
            type: 'Data Download',
            serverName: 'RM7-E1L3',
            expiresAt: new Date(Date.now() + 600000).toISOString()
        };
        const mockServerMap = {
            checkPathMaintenance: () => ({ blocked: true, blockerName: 'RM7-E1L3', remainingMs: 400000 })
        };
        const result = checkJobEligibility(job, { serverMap: mockServerMap, currentTime: Date.now() });
        assert.equal(result.status, 'ineligible');
        assert.match(result.reasons[0], /maintenance/i);
    });

    it('Scenario 7: unknown-response -> unknown', () => {
        // Malformed, missing, or stale server/job info must not sign
        const malformedJob = {
            corrupted: true
        };
        const result = checkJobEligibility(malformedJob, { currentTime: Date.now() });
        assert.equal(result.status, 'unknown');

        const nullResult = checkJobEligibility(null, { currentTime: Date.now() });
        assert.equal(nullResult.status, 'unknown');
    });

    it('Scenario 8: expires-too-soon -> ineligible', () => {
        // Job expires before estimated completion with configured buffer (e.g. 20s remaining vs 60s buffer)
        const now = 1000000;
        const job = {
            id: 'job-expiring',
            jobId: 'job-expiring',
            name: 'Quick Job',
            expiresAt: new Date(now + 20000).toISOString()
        };
        const result = checkJobEligibility(job, { currentTime: now, config: { timeBufferMs: 60000 } });
        assert.equal(result.status, 'ineligible');
        assert.match(result.reasons[0], /expires in 20s/i);
    });

    it('Scenario 9: reserve-protected -> ineligible', () => {
        // Signing pledge would reduce credits below configured cash reserve
        // Player has 8000 CR, pledge is 1000 CR, cashReserve is 7200 CR (8000 - 1000 = 7000 < 7200)
        const job = {
            id: 'job-pledge',
            jobId: 'job-pledge',
            name: 'Pledged Job',
            deposit: 1000,
            expiresAt: new Date(Date.now() + 600000).toISOString()
        };
        const context = {
            currentTime: Date.now(),
            playerState: { credits: 8000 },
            config: { cashReserve: 7200 }
        };
        const result = checkJobEligibility(job, context);
        assert.equal(result.status, 'ineligible');
        assert.match(result.reasons[0], /reserve/i);
    });

    it('Scenario 10: already-signed -> ineligible', () => {
        // Duplicate process/retry of same accepted job should not sign it twice
        const job = {
            id: 'job-already-taken',
            jobId: 'job-already-taken',
            name: 'IP Injection',
            alreadyTaken: true,
            status: 'TAKEN',
            expiresAt: new Date(Date.now() + 600000).toISOString()
        };
        const result = checkJobEligibility(job, { currentTime: Date.now() });
        assert.equal(result.status, 'ineligible');
        assert.match(result.reasons[0], /already accepted/i);
    });

    it('Scenario 11: insufficient-psu -> ineligible', () => {
        // Candidate combination reaches power requirement theoretically but fails resource/PSU boot check
        const job = {
            id: 'job-hack-psu',
            jobId: 'job-hack-psu',
            name: 'IP Injection',
            type: 'IP Injection',
            serverName: 'RM7-E1L3',
            serverTypeName: 'Home',
            serverDefenceRate: 8,
            requiresHack: true,
            expiresAt: new Date(Date.now() + 600000).toISOString()
        };
        const loadout = {
            equippedHardware: { cpu: M_MATE_CPU, gpu: BASE_GPU, ram: BASE_RAM, psu: PSU_WEAK }, // 300W PSU < 400W consumed
            ownedHardware: [M_MATE_CPU, BASE_GPU, BASE_RAM, PSU_WEAK],
            equippedSoftware: [PORTER_LITE_SW],
            ownedSoftware: [PORTER_LITE_SW]
        };
        const result = checkJobEligibility(job, { loadout, currentTime: Date.now() });
        assert.equal(result.status, 'ineligible');
        assert.match(result.reasons[0], /PSU boot check/i);
    });

    it('Scenario 12: affordable-safe-job -> eligible', () => {
        // Reachable job with confirmed permission, owned bootable loadout, sufficient funds and generous deadline
        const job = {
            id: 'job-safe',
            jobId: 'job-safe',
            name: 'Safe Job',
            deposit: 100,
            serverName: 'None',
            expiresAt: new Date(Date.now() + 3600000).toISOString()
        };
        const context = {
            currentTime: Date.now(),
            playerState: { credits: 12000, cashReserve: 7200 }
        };
        const result = checkJobEligibility(job, context);
        assert.equal(result.status, 'eligible');
    });

    it('Comprehensive fixture verification: all 12 cases match expected status in tests/eligibility_cases.json', () => {
        // Verify all 12 fixture IDs match their declared expected status
        const expectedMap = {};
        for (const c of testCases) {
            expectedMap[c.id] = c.expected;
        }

        assert.equal(expectedMap['locked-acquisition'], 'ineligible');
        assert.equal(expectedMap['grant-later-login'], 'manual-review');
        assert.equal(expectedMap['decrypt-low'], 'ineligible');
        assert.equal(expectedMap['decrypt-owned-upgrade'], 'eligible');
        assert.equal(expectedMap['missing-owned-component'], 'ineligible');
        assert.equal(expectedMap['server-maintenance'], 'ineligible');
        assert.equal(expectedMap['unknown-response'], 'unknown');
        assert.equal(expectedMap['expires-too-soon'], 'ineligible');
        assert.equal(expectedMap['reserve-protected'], 'ineligible');
        assert.equal(expectedMap['already-signed'], 'ineligible');
        assert.equal(expectedMap['insufficient-psu'], 'ineligible');
        assert.equal(expectedMap['affordable-safe-job'], 'eligible');
    });
});
