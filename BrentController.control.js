loadAPI(1);

host.defineController(
"SchmoTone",
"BrentController",
"1.0",
"86725bf0-6317-11e9-b475-0800200c9a66"
);

host.defineMidiPorts(1, 1);

var CC_RANGE_HI = 100;
var CC_RANGE_LO = 60;

function init() {
	host.getMidiInPort(0).setMidiCallback(onMidiPort1);
	noteIn = host.getMidiInPort(0).createNoteInput("Notes");
	userControls = host.createUserControlsSection(CC_RANGE_HI - CC_RANGE_LO + 1);
	for (var i = CC_RANGE_LO; i<=CC_RANGE_HI; i++) {
		userControls.getControl(i - CC_RANGE_LO).setLabel("CC"+i);
	}
	transport = host.createTransport();
	println("init yo!");
}

function onMidiPort1(status, data1, data2) {
	if (isChannelController(status)) {
		if (data1 >= CC_RANGE_LO && data1 <= CC_RANGE_HI) {
			var index = data1 - CC_RANGE_LO;
			userControls.getControl(index).set(data2, 128);
		}
	}
}

function exit() {
	println("exit");
}

// for note-on, velocity is in data2
// aftertouch is in Channel Aft messages
// the knobs on the advance do work differently.  on the mpk they range from 0 to 7f
// on the advance they just do full on or full off.  maybe that's what the forum dude meants about
// actuator vs potentiometer
// on mpk, fwd data1 is 74, and back data1 is 73
// stop 75
// play 76
// record 77


