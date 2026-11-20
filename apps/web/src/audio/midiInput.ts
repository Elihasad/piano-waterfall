export interface MidiDeviceState {
  supported: boolean;
  connectedNames: string[];
  error?: string;
}

export interface MidiCallbacks {
  onNoteOn: (midi: number, velocity: number) => void;
  onNoteOff: (midi: number) => void;
  onDevicesChange: (state: MidiDeviceState) => void;
}

interface MidiMessageEventLike {
  data: Uint8Array | null;
}

interface MidiInputLike {
  id: string;
  name?: string | null;
  state?: string;
  onmidimessage: ((event: MidiMessageEventLike) => void) | null;
}

interface MidiAccessLike {
  inputs: Map<string, MidiInputLike>;
  onstatechange: (() => void) | null;
}

export class MidiInputManager {
  private access: MidiAccessLike | null = null;
  private callbacks: MidiCallbacks;

  constructor(callbacks: MidiCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(): Promise<MidiDeviceState> {
    if (
      typeof navigator === 'undefined' ||
      typeof (navigator as unknown as { requestMIDIAccess?: unknown }).requestMIDIAccess !== 'function'
    ) {
      const state: MidiDeviceState = { supported: false, connectedNames: [] };
      this.callbacks.onDevicesChange(state);
      return state;
    }

    try {
      const req = (navigator as unknown as { requestMIDIAccess: () => Promise<MidiAccessLike> })
        .requestMIDIAccess;
      this.access = await req.call(navigator);
      this.access.onstatechange = () => this.bindInputs();
      return this.bindInputs();
    } catch (err) {
      const state: MidiDeviceState = {
        supported: true,
        connectedNames: [],
        error: err instanceof Error ? err.message : 'MIDI access denied',
      };
      this.callbacks.onDevicesChange(state);
      return state;
    }
  }

  private bindInputs(): MidiDeviceState {
    if (!this.access) return { supported: false, connectedNames: [] };
    const names: string[] = [];

    for (const input of this.access.inputs.values()) {
      if (input.state === 'disconnected') continue;
      names.push(input.name || 'MIDI Piano');
      input.onmidimessage = (ev) => {
        if (!ev.data || ev.data.length < 3) return;
        const status = ev.data[0] & 0xf0;
        const midi = ev.data[1];
        const velocity = ev.data[2];
        if (status === 0x90 && velocity > 0) {
          this.callbacks.onNoteOn(midi, velocity / 127);
        } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
          this.callbacks.onNoteOff(midi);
        }
      };
    }

    const state: MidiDeviceState = { supported: true, connectedNames: names };
    this.callbacks.onDevicesChange(state);
    return state;
  }

  disconnect(): void {
    if (!this.access) return;
    this.access.onstatechange = null;
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = null;
    }
    this.access = null;
  }
}
