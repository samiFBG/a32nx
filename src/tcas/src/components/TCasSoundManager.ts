/* eslint-disable no-underscore-dangle */
import { TCasComponent } from '@tcas/lib/TCasComponent';

// TODO: Turn into abstract SoundManager class for all .ts components

class PeriodicSound {
    public sound: { name: string, length: number};

    public period: number;

    public timeSinceLastPlayed: number;

    constructor(sound: { name: string, length: number}, period: number) {
        this.sound = sound;
        this.period = period;
        this.timeSinceLastPlayed = NaN;
    }
}

export class TCasSoundManager implements TCasComponent {
    private static _instance?: TCasSoundManager;

    public static get instance(): TCasSoundManager {
        if (!this._instance) {
            this._instance = new TCasSoundManager();
        }
        return this._instance;
    }

    private periodicList: PeriodicSound[];

    private soundQueue: { name: string, length: number}[];

    private playingSound: { name: string, length: number} | null;

    private playingSoundRemaining: number;

    constructor() {
        this.periodicList = [];
        this.soundQueue = [];

        this.playingSound = null;
        this.playingSoundRemaining = NaN;
    }

    init(): void {

    }

    update(deltaTime: number): void {
        if (this.playingSoundRemaining <= 0) {
            this.playingSound = null;
            this.playingSoundRemaining = NaN;
        } else if (this.playingSoundRemaining > 0) {
            this.playingSoundRemaining -= deltaTime / 1000;
        }

        if (this.playingSound === null && this.soundQueue.length > 0) {
            const _sound: { name: string, length: number} = this.soundQueue.shift();
            this.tryPlaySound(_sound);
        }

        this.periodicList.forEach((element: PeriodicSound) => {
            if (Number.isNaN(element.timeSinceLastPlayed) || element.timeSinceLastPlayed >= element.period) {
                if (this.tryPlaySound(element.sound)) {
                    element.timeSinceLastPlayed = 0;
                }
            } else {
                element.timeSinceLastPlayed += deltaTime / 1000;
            }
        });
    }

    addPeriodicSound(sound: { name: string, length: number}, period: number = NaN) {
        if (!sound) {
            return;
        }

        let useLengthForPeriod: boolean = false;
        if (period < sound.length) {
            console.error("TCasSoundManager ERROR: Sound period can't be smaller than sound length. Using sound length instead.");
            useLengthForPeriod = true;
        }

        let found: boolean = false;
        this.periodicList.forEach((element: PeriodicSound) => {
            if (element.sound.name === sound.name) {
                found = true;
            }
        });

        if (!found) {
            this.periodicList.push(new PeriodicSound(sound, useLengthForPeriod ? sound.length : period));
        }
    }

    removePeriodicSound(sound) {
        if (!sound) {
            return;
        }

        for (let i = 0; i < this.periodicList.length; i++) {
            if (this.periodicList[i].sound.name === sound.name) {
                this.periodicList.splice(i, 1);
            }
        }
    }

    tryPlaySound(sound, retry = false, repeatOnce = false): boolean | null {
        if (this.playingSound === null) {
            this.playingSound = sound;
            this.playingSoundRemaining = sound.length;
            console.log('SOUND: playing ', sound);
            Coherent.call('PLAY_INSTRUMENT_SOUND', sound.name).catch(console.error);
            if (repeatOnce) {
                this.soundQueue.push(sound);
            }
            return true;
        }
        if (retry) {
            this.soundQueue.push(sound);
            if (repeatOnce) {
                this.soundQueue.push(sound);
            }
            return false;
        }
        return false;
    }
}
