import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateAnalysis,
    hardwareMatches,
    findBestSoftwareLoadout,
    findCheapestMissingHardware,
    resolveLoadoutRequirement,
    findHackSoftwareForServerType,
    findDecryptSoftwareForFileType
} from '../src/shared/loadout-resolver.js';

// Reusable mock fixtures based on COR3.gg specs and references/PDF_NOTES.md
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

const OMNIPIX_GPU = {
    id: 'gpu-omnipix',
    name: 'OmniPix 23.2',
    category: 'GPU',
    price: 8500,
    specs: { gpuPower: 2800, gpuMemory: 8192, gpuConsuming: 350 }
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

const EMERALD_H3S12_RAM = {
    id: 'ram-emerald-h3s12',
    name: 'Emerald H3S12',
    category: 'RAM',
    price: 11000,
    specs: { ramFrequency: 4800, ramMemory: 24576 }
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

// Cypher+ v1.4 DECRYPT tool (.eb52x, .ab52p, power [11, 20])
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

// Porter-lite r4 HACK tool (power [8, 17])
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

describe('Loadout Resolver Tests (Phase 3 & PDF Reference Validation)', () => {
    it('1. Cypher+ v1.4 achieves DECRYPT 11 with base M-Mate CPU and standard RAM', () => {
        const loadout = {
            equippedHardware: { cpu: M_MATE_CPU, gpu: BASE_GPU, ram: BASE_RAM, psu: PSU_1550 },
            ownedHardware: [M_MATE_CPU, BASE_GPU, BASE_RAM, PSU_1550],
            equippedSoftware: [CYPHER_PLUS_SW],
            ownedSoftware: [CYPHER_PLUS_SW]
        };
        const candidates = findDecryptSoftwareForFileType(loadout.ownedSoftware, 'eb52x');
        const best = findBestSoftwareLoadout(loadout, candidates, 'DECRYPT');

        assert.ok(best, 'Loadout should resolve');
        assert.equal(best.power, 11, 'Cypher+ with base hardware should compute power 11');
    });

    it('2. Cypher+ v1.4 achieves DECRYPT 15 with UNO 6.651 CPU and Emerald H2S9 RAM', () => {
        const loadout = {
            equippedHardware: { cpu: UNO_CPU, gpu: BASE_GPU, ram: EMERALD_H2S9_RAM, psu: PSU_1550 },
            ownedHardware: [UNO_CPU, BASE_GPU, EMERALD_H2S9_RAM, PSU_1550],
            equippedSoftware: [CYPHER_PLUS_SW],
            ownedSoftware: [CYPHER_PLUS_SW]
        };
        const candidates = findDecryptSoftwareForFileType(loadout.ownedSoftware, 'eb52x');
        const best = findBestSoftwareLoadout(loadout, candidates, 'DECRYPT');

        assert.ok(best);
        assert.equal(best.power, 15, 'Cypher+ with UNO and Emerald H2S9 should reach power 15');
    });

    it('3. Cypher+ v1.4 achieves max DECRYPT 20 with UNO 6.651 CPU and Emerald H3S12 RAM', () => {
        const loadout = {
            equippedHardware: { cpu: UNO_CPU, gpu: BASE_GPU, ram: EMERALD_H3S12_RAM, psu: PSU_1550 },
            ownedHardware: [UNO_CPU, BASE_GPU, EMERALD_H3S12_RAM, PSU_1550],
            equippedSoftware: [CYPHER_PLUS_SW],
            ownedSoftware: [CYPHER_PLUS_SW]
        };
        const candidates = findDecryptSoftwareForFileType(loadout.ownedSoftware, 'eb52x');
        const best = findBestSoftwareLoadout(loadout, candidates, 'DECRYPT');

        assert.ok(best);
        assert.equal(best.power, 20, 'Cypher+ with max hardware should reach max power 20');
    });

    it('4. Porter-lite r4 achieves HACK 8 with M-Mate CPU and standard GPU', () => {
        const loadout = {
            equippedHardware: { cpu: M_MATE_CPU, gpu: BASE_GPU, ram: BASE_RAM, psu: PSU_1550 },
            ownedHardware: [M_MATE_CPU, BASE_GPU, BASE_RAM, PSU_1550],
            equippedSoftware: [PORTER_LITE_SW],
            ownedSoftware: [PORTER_LITE_SW]
        };
        const candidates = findHackSoftwareForServerType(loadout.ownedSoftware, 'Corporate');
        const best = findBestSoftwareLoadout(loadout, candidates, 'HACK');

        assert.ok(best);
        assert.equal(best.power, 8, 'Porter-lite with base hardware should compute power 8');
    });

    it('5. Porter-lite r4 achieves HACK 12 with UNO CPU and OmniPix GPU', () => {
        const loadout = {
            equippedHardware: { cpu: UNO_CPU, gpu: OMNIPIX_GPU, ram: BASE_RAM, psu: PSU_1550 },
            ownedHardware: [UNO_CPU, OMNIPIX_GPU, BASE_RAM, PSU_1550],
            equippedSoftware: [PORTER_LITE_SW],
            ownedSoftware: [PORTER_LITE_SW]
        };
        const candidates = findHackSoftwareForServerType(loadout.ownedSoftware, 'Corporate');
        const best = findBestSoftwareLoadout(loadout, candidates, 'HACK');

        assert.ok(best);
        assert.equal(best.power, 12, 'Porter-lite with UNO and OmniPix should reach power 12');
    });

    it('6. Fails boot when PSU power is insufficient (PSU constraint)', () => {
        // CPU consumes 450, GPU consumes 350 -> total 800W. Weak PSU is 300W.
        const loadout = {
            equippedHardware: { cpu: UNO_CPU, gpu: OMNIPIX_GPU, ram: BASE_RAM, psu: PSU_WEAK },
            ownedHardware: [UNO_CPU, OMNIPIX_GPU, BASE_RAM, PSU_WEAK],
            equippedSoftware: [PORTER_LITE_SW],
            ownedSoftware: [PORTER_LITE_SW]
        };
        const analysis = calculateAnalysis(loadout, [PORTER_LITE_SW.id]);
        assert.equal(analysis.canBoot, false, 'System should fail to boot when PSU is insufficient');

        const result = resolveLoadoutRequirement(loadout, {
            abilityType: 'HACK',
            targetPower: 12,
            serverTypeName: 'Corporate'
        });
        assert.equal(result.achievableWithOwned.canBoot, false);
        assert.equal(result.achievableWithOwned.meetsTarget, false);
        assert.match(result.achievableWithOwned.reason, /PSU/i);
    });

    it('7. Recommends missing catalog hardware without purchasing when target power is unreachable with owned gear', () => {
        // Player only owns M-Mate (power 11), needs Decrypt 15
        const loadout = {
            equippedHardware: { cpu: M_MATE_CPU, gpu: BASE_GPU, ram: EMERALD_H2S9_RAM, psu: PSU_1550 },
            ownedHardware: [M_MATE_CPU, BASE_GPU, EMERALD_H2S9_RAM, PSU_1550],
            equippedSoftware: [CYPHER_PLUS_SW],
            ownedSoftware: [CYPHER_PLUS_SW]
        };
        const catalog = [UNO_CPU, OMNIPIX_GPU];

        const result = resolveLoadoutRequirement(loadout, {
            abilityType: 'DECRYPT',
            targetPower: 15,
            fileType: 'eb52x',
            catalogHardware: catalog
        });

        assert.equal(result.achievableWithOwned.meetsTarget, false);
        assert.equal(result.achievableWithOwned.power, 11);
        assert.ok(result.cheapestMissingPurchases, 'Should provide missing purchases list');
        assert.equal(result.cheapestMissingPurchases[0].id, 'cpu-uno');
        assert.equal(result.cheapestMissingPurchases[0].projectedPower, 15);
        assert.equal(result.cheapestMissingPurchases[0].price, 14490);
    });

    it('8. hardwareMatches accurately detects identical vs changed hardware', () => {
        const hwA = { cpu: M_MATE_CPU, gpu: BASE_GPU, ram: BASE_RAM, psu: PSU_1550 };
        const hwB = { cpu: M_MATE_CPU, gpu: BASE_GPU, ram: BASE_RAM, psu: PSU_1550 };
        const hwC = { cpu: UNO_CPU, gpu: BASE_GPU, ram: BASE_RAM, psu: PSU_1550 };

        assert.equal(hardwareMatches(hwA, hwB), true);
        assert.equal(hardwareMatches(hwA, hwC), false);
    });
});
