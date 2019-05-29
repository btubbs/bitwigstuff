loadAPI(8);

// Remove this if you want to be able to use deprecated methods without causing script to stop.
// This is useful during development.
host.setShouldFailOnDeprecatedUse(true);

host.defineController("Akai", "Advance61", "0.1", "ad147f1f-fe8e-4a41-aadd-a8bd76280874", "Brent Tubbs");

host.defineMidiPorts(1, 1);

const BUTTON_LOOP = 0x72;

const KNOB_START = 50;
const KNOB_COUNT = 8;

const BUTTON_START = 30;
const BUTTON_COUNT = 7;
// use the last button as a mode toggle instead of a track selector, so we can
// get more functionality from the other buttons and knobs.
const BUTTON_MODE = 37;

const MODE_MIX = 0;
const MODE_INST = 1;
var MODE = MODE_MIX;

const SYSEX_STOP = "f07f7f0601f7";
const SYSEX_PLAY = "f07f7f0602f7";
const SYSEX_RECORD = "f07f7f0606f7";

// an array of no-argument functions that will be called on flush(),
// which will then empty the array.  
var FLUSH_FUNCS = [];

if (host.platformIsWindows())
{
   // TODO: Set the correct names of the ports for auto detection on Windows platform here
   // and uncomment this when port names are correct.
   host.addDeviceNameBasedDiscoveryPair(["ADVANCE61 USB PORT 1"], ["ADVANCE61 USB PORT 1"]);
} 
else if (host.platformIsMac())
{
   // TODO: Set the correct names of the ports for auto detection on Mac OSX platform here
   // and uncomment this when port names are correct.
   // host.addDeviceNameBasedDiscoveryPair(["Input Port 0"], ["Output Port 0"]);
}
else if (host.platformIsLinux())
{
   // TODO: Set the correct names of the ports for auto detection on Linux platform here
   // and uncomment this when port names are correct.
   // host.addDeviceNameBasedDiscoveryPair(["Input Port 0"], ["Output Port 0"]);
}

function init() {
	println("Initializing Advance61...");
	transport = host.createTransport();
	transport.isArrangerLoopEnabled().addValueObserver(onLoopValue);
	transport.isPlaying().addValueObserver(function(playing) {println("playing " + playing)});	
	
	var inputPort = host.getMidiInPort(0);
	inputPort.setMidiCallback(onMidi0);
	inputPort.setSysexCallback(onSysex0);
	inputPort.createNoteInput("Keys", "80????", "90????", "B001??", "B040??", "D0????", "E0????");
	inputPort.createNoteInput("Pads", "89????", "99????", "D9????");
	
	trackBank = host.createMainTrackBank(8, 0, 0);
	for (i=0;i<trackBank.getSizeOfBank(); i++) {
		var track = trackBank.getItemAt(i);
		var p = track.volume();
		p.markInterested();
		p.setIndication(true);
	}
	cursorTrack = host.createCursorTrack("ADVANCE61_CURSOR_TRACK", "Cursor Track", 0, 0, true);
	trackBank.followCursorTrack(cursorTrack);
	
	cursorDevice = cursorTrack.createCursorDevice ("ADVANCE61_CURSOR_DEVICE", "Cursor Device", 0, CursorDeviceFollowMode.FOLLOW_SELECTION);
	remoteControlsBank = cursorDevice.createCursorRemoteControlsPage(KNOB_COUNT);
    for (i = 0; i < this.remoteControlsBank.getParameterCount(); i++) {
        remoteControlsBank.getParameter(i).markInterested();
		remoteControlsBank.getParameter(i).setIndication(true);
	}
	cursorDevice.isEnabled().markInterested();
	cursorDevice.isWindowOpen().markInterested();
	
	app = host.createApplication();
	app.panelLayout().markInterested();
	app.panelLayout().addValueObserver(function(layout) {println("layout " + layout)});
	app.displayProfile().addValueObserver(function(profile) {println("display " + profile)});
	
	// for mappable knobs
	// userControls = host.createUserControls(KNOB_COUNT + 1);
	// for (var i = KNOB_START; i<=KNOB_START+KNOB_COUNT; i++) {
		// userControls.getControl(i - KNOB_START).setLabel("CC"+i);
	// }	


	println("Initialized!");
}

// global funcs are available in all modes.
GLOBAL_FUNCS = {};
GLOBAL_FUNCS[BUTTON_MODE] = function(status, data1, data2) {
	MODE = data2 == 127 ? MODE_INST : MODE_MIX;
}
// loop control button
GLOBAL_FUNCS[BUTTON_LOOP] = function() {transport.isArrangerLoopEnabled().toggle();}

// nested maps of mode-specific functions
MODE_FUNCS = {};
MODE_FUNCS[MODE_MIX] = {};
MODE_FUNCS[MODE_INST] = {};


// knobs
for (i=KNOB_START; i<KNOB_START+KNOB_COUNT;i++) {
	MODE_FUNCS[MODE_MIX][i] = function(status, data1, data2){
		// this assumes that the knobs on the Advance are in the +/- mode, and not absolute values.
		
		// this sets up knobs to be mappable, which is nice
		// but it sounds like we need to get into "remotes" to have knobs automatically mapped
		// to instrument controls.
		var index = data1 - KNOB_START;
		var delta = data2 == 127 ? -2 : 2;
		println(["mix knob", status, index, data2, delta].join("|"));
		
		// control volume on track that corresponds to this knob
		trackBank.getItemAt(index).volume().inc(delta, 128);
		
		// control user-mapped parameter
		// userControls.getControl(index).inc(delta, 128);		
	};
}
for (i=KNOB_START; i<KNOB_START+KNOB_COUNT;i++) {
	MODE_FUNCS[MODE_INST][i] = function(status, data1, data2){
		var index = data1 - KNOB_START;
		var delta = data2 == 127 ? -2 : 2;
		println(["inst knob", status, index, data2, delta].join("|"));
		remoteControlsBank.getParameter(index).inc(delta, 128);
	};
}

// buttons
for (i=BUTTON_START; i<BUTTON_START+BUTTON_COUNT;i++) {
	MODE_FUNCS[MODE_MIX][i] = function(status, data1, data2){
		var index = data1 - BUTTON_START;
		println(["button", status, index, data2].join("|"));
		var track = trackBank.getItemAt(index);
		track.select();
		track.makeVisibleInArranger();
		track.makeVisibleInMixer();
	}
}

function onMidi0(status, data1, data2) {
   printMidi(status, data1, data2);
   if (func = GLOBAL_FUNCS[data1]) {
	   func(status, data1, data2);
	   return;
	}
	
	if ((modefuncs = MODE_FUNCS[MODE]) && (func = modefuncs[data1])) {
	   func(status, data1, data2);
	   return;		
	}
	host.errorln("Command " + data1 + " is not supported");
}

// MMC Transport Controls:
// NOTE: Must switch the Advance's global "Transport Format" setting to MMC for this to work.
SYSEX_FUNCS = {};
SYSEX_FUNCS[SYSEX_STOP] =  function() {transport.stop()};
SYSEX_FUNCS[SYSEX_PLAY] =  function() {transport.play()};
SYSEX_FUNCS[SYSEX_RECORD] =  function() {transport.record()};

function onSysex0(data) {
   printSysex(data);
   func = SYSEX_FUNCS[data];
   if (func) {
	   func(data);
   } else {
		host.errorln("Command " + data + " is not supported");	   
   }
}

function onLoopValue(on) {
   // TODO: get the controller's loop button light to match this.		
	//println("loop " + on);
	// turn everything on!
	// sendMidi(177, 30, 127);
	// sendMidi(177, 30, 0);
	// sendMidi(176, 118, 127);
	// sendMidi(176, 119, 127);
	// sendMidi(176, 117, 127);
	FLUSH_FUNCS.push(function() {
		sendMidi(176, 114, on ? 127 : 0);		
	});
}

function flush() {
	// Call any functions that have been queued for flush, then reset the queue
	FLUSH_FUNCS.forEach(function(f) {
		f();
	});
	FLUSH_FUNCS = [];
}

function exit() {

}