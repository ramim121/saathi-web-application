/**
 * Checks the pure rules behind the booking payment window: deadlines,
 * reminders, the derived booking state, and partner allocation without
 * spilling into held room. There is no test runner in this repo; this is the
 * nearest thing, and it touches no database.
 *
 *   TS_NODE_BASEURL=. npx ts-node -r tsconfig-paths/register \
 *     --compiler-options '{"module":"commonjs","target":"es2020","esModuleInterop":true}' \
 *     db/check-booking-holds.ts
 *
 * Exits 1 on the first failed check.
 */
import assert from 'node:assert/strict';
import {
    bookingState,
    dueAfterFailedCollection,
    dueAfterRejection,
    dueDateFor,
    effectiveDue,
    endOfDhakaDay,
    formatDue,
    formatDueDay,
    launchDueDate,
    reminderTimes,
    remindersDue,
    timeLeft,
} from '../src/utils/bookingHoldsShared';
import { fitAllocation, unitsLeft, type PartnerLoad } from '../src/utils/partnerCapacityShared';

let passed = 0;
function check(name: string, fn: () => void) {
    try {
        fn();
        passed += 1;
        console.log(`  ok  ${name}`);
    } catch (err) {
        console.error(`FAIL  ${name}\n      ${(err as Error).message}`);
        process.exit(1);
    }
}
const iso = (d: Date | null) => (d ? d.toISOString() : null);

console.log('Deadlines (Dhaka = UTC+6)');

check('booked 27 Nov 15:00 Dhaka is due 2 Dec 23:59:59 Dhaka', () => {
    // 27 Nov 15:00 Dhaka = 09:00 UTC; 2 Dec 23:59:59 Dhaka = 17:59:59 UTC
    assert.equal(iso(dueDateFor('2026-11-27T09:00:00Z', 5)), '2026-12-02T17:59:59.000Z');
});
check('booked 3 a.m. Dhaka counts that Dhaka day, not the UTC day before', () => {
    // 28 Nov 03:00 Dhaka = 27 Nov 21:00 UTC → Dhaka day 28 Nov → due 3 Dec
    assert.equal(iso(dueDateFor('2026-11-27T21:00:00Z', 5)), '2026-12-03T17:59:59.000Z');
});
check('booked 23:59 Dhaka on the 27th is still the 27th', () => {
    assert.equal(iso(dueDateFor('2026-11-27T17:59:00Z', 5)), '2026-12-02T17:59:59.000Z');
});
check('a window crosses month and year ends', () => {
    assert.equal(iso(dueDateFor('2026-12-29T06:00:00Z', 5)), '2027-01-03T17:59:59.000Z');
});
check('window length comes from the argument', () => {
    assert.equal(iso(dueDateFor('2026-11-27T09:00:00Z', 1)), '2026-11-28T17:59:59.000Z');
});
check('end of Dhaka day', () => {
    assert.equal(iso(endOfDhakaDay('2026-11-28T06:32:00Z')), '2026-11-28T17:59:59.000Z');
});

console.log('Launch backfill (decision 3)');

check('an old booking gets launch day + 2', () => {
    assert.equal(iso(launchDueDate('2026-03-05T02:47:17Z', '2026-11-28T06:32:00Z', 5)), '2026-11-30T17:59:59.000Z');
});
check('a recent booking keeps its natural deadline when later', () => {
    assert.equal(iso(launchDueDate('2026-11-26T04:04:52Z', '2026-11-28T06:32:00Z', 5)), '2026-12-01T17:59:59.000Z');
});
check('matches the plan 4.3 SQL on staging rows (phase 0, query 7)', () => {
    // created 2026-11-24 18:40 UTC = 25 Nov 00:40 Dhaka → natural 30 Nov
    assert.equal(iso(launchDueDate('2026-11-24T18:40:00Z', '2026-11-28T06:32:20Z', 5)), '2026-11-30T17:59:59.000Z');
});

console.log('Rejected receipt (decision 5) and failed collection');

check('rejection on day 1 keeps the original deadline', () => {
    const due = new Date('2026-12-02T17:59:59Z');
    assert.equal(iso(dueAfterRejection(due, '2026-11-28T06:00:00Z', due)), '2026-12-02T17:59:59.000Z');
});
check('rejection on the last day gives 48 h from the rejection', () => {
    const due = new Date('2026-12-02T17:59:59Z');
    assert.equal(iso(dueAfterRejection(due, '2026-12-02T10:00:00Z', due)), '2026-12-04T10:00:00.000Z');
});
check('rejection with no stored deadline uses the fallback', () => {
    const fallback = new Date('2026-11-20T17:59:59Z');
    assert.equal(iso(dueAfterRejection(null, '2026-11-28T06:00:00Z', fallback)), '2026-11-30T06:00:00.000Z');
});
check('failed collection gives at least 48 h', () => {
    const due = new Date('2026-11-29T17:59:59Z');
    assert.equal(iso(dueAfterFailedCollection(due, '2026-11-29T12:00:00Z', due)), '2026-12-01T12:00:00.000Z');
});

console.log('Reminders (decision 6: 10:00 Dhaka two days before, and on the last day)');

const due = new Date('2026-12-02T17:59:59Z'); // 2 Dec 23:59:59 Dhaka
check('two reminder times, 30 Nov and 2 Dec at 10:00 Dhaka', () => {
    assert.deepEqual(reminderTimes(due).map(iso), ['2026-11-30T04:00:00.000Z', '2026-12-02T04:00:00.000Z']);
});
check('none due before the first', () => assert.equal(remindersDue(due, new Date('2026-11-30T03:59:00Z')), 0));
check('one due from 30 Nov 10:00', () => assert.equal(remindersDue(due, new Date('2026-11-30T04:00:00Z')), 1));
check('two due from 2 Dec 10:00', () => assert.equal(remindersDue(due, new Date('2026-12-02T04:00:00Z')), 2));
check('a deadline at 09:00 Dhaka has no last-day reminder', () => {
    // 4 Dec 09:00 Dhaka = 03:00 UTC; the 10:00 reminder would come after it
    assert.deepEqual(reminderTimes(new Date('2026-12-04T03:00:00Z')).map(iso), ['2026-12-02T04:00:00.000Z']);
});

console.log('Booking state (plan 5.1)');

const now = new Date('2026-11-28T06:00:00Z');
const base = { cancelled: 'no', cancelReason: null, createdAt: '2026-11-27T09:00:00Z', paymentDueAt: '2026-12-02T17:59:59Z' };
check('pending in the window: awaiting payment', () => assert.equal(bookingState({ ...base, paymentConfirmationStatus: 'pending' }, now), 'awaiting_payment'));
check('denied in the window: receipt rejected', () => assert.equal(bookingState({ ...base, paymentConfirmationStatus: 'denied' }, now), 'receipt_rejected'));
check('uploaded: under review', () => assert.equal(bookingState({ ...base, paymentConfirmationStatus: 'uploaded' }, now), 'under_review'));
check('proof_submitted: under review', () => assert.equal(bookingState({ ...base, paymentConfirmationStatus: 'proof_submitted' }, now), 'under_review'));
check('under review past the deadline still under review (decision 1)', () =>
    assert.equal(bookingState({ ...base, paymentConfirmationStatus: 'uploaded' }, new Date('2026-12-10T00:00:00Z')), 'under_review'));
check('pending past the deadline, before the job: expired', () =>
    assert.equal(bookingState({ ...base, paymentConfirmationStatus: 'pending' }, new Date('2026-12-02T18:00:00Z')), 'expired'));
check('the deadline second itself counts as expired (SQL holds while due > now)', () =>
    assert.equal(bookingState({ ...base, paymentConfirmationStatus: 'pending' }, new Date('2026-12-02T17:59:59Z')), 'expired'));
check('confirmed', () => assert.equal(bookingState({ ...base, paymentConfirmationStatus: 'confirmed' }, new Date('2027-01-01T00:00:00Z')), 'confirmed'));
check('cancelled by the job: expired', () =>
    assert.equal(bookingState({ ...base, paymentConfirmationStatus: 'pending', cancelled: 'yes', cancelReason: 'expired' }, now), 'expired'));
check('cancelled by hand: cancelled', () =>
    assert.equal(bookingState({ ...base, paymentConfirmationStatus: 'pending', cancelled: 'yes', cancelReason: 'admin' }, now), 'cancelled'));
check('cancelled before migration 017 (no reason): cancelled', () =>
    assert.equal(bookingState({ ...base, paymentConfirmationStatus: 'uploaded', cancelled: 'yes' }, now), 'cancelled'));
check('no stored deadline (not backfilled yet): no deadline, still awaiting payment', () => {
    assert.equal(effectiveDue({ paymentDueAt: null }), null);
    assert.equal(bookingState({ ...base, paymentDueAt: null, paymentConfirmationStatus: 'pending' }, new Date('2027-01-01T00:00:00Z')), 'awaiting_payment');
});

console.log('Formatting');

check('English', () => assert.equal(formatDue('2026-12-02T17:59:59Z'), '2 Dec, 11:59 PM'));
check('English, morning', () => assert.equal(formatDue('2026-12-04T03:00:00Z'), '4 Dec, 9:00 AM'));
check('Bangla', () => assert.equal(formatDue('2026-12-02T17:59:59Z', 'bn'), '২ ডিসেম্বর, রাত ১১:৫৯'));
check('day only', () => assert.equal(formatDueDay('2026-12-02T17:59:59Z'), '2 Dec 2026'));
check('time left', () => {
    assert.equal(timeLeft('2026-12-02T17:59:59Z', new Date('2026-11-30T12:00:00Z')), '2 days 5 h');
    assert.equal(timeLeft('2026-12-02T17:59:59Z', new Date('2026-12-03T00:00:00Z')), '');
});

console.log('Partner allocation without spill (plan 4.1)');

const partner = (id: number, capacity: number, confirmed: number, pending: number): PartnerLoad => ({
    idProjectPartners: id, idProjects: 1, idUsers: 100 + id, fullName: `P${id}`, capacity, confirmed, pending,
});

check('the plan 3 example: 2 partners x 5, X holds 6 unpaid, Y asks 6: refused', () => {
    // X's 6 were placed 3 + 3. Room left is 2 + 2 = 4.
    const fit = fitAllocation([partner(1, 5, 0, 3), partner(2, 5, 0, 3)], 6);
    assert.equal(fit.shortfall, 2);
    assert.equal(fit.allocations.reduce((s, a) => s + a.units, 0), 4);
});
check('held room is never used, even when it is the only room', () => {
    const fit = fitAllocation([partner(1, 5, 2, 3)], 1);
    assert.equal(fit.shortfall, 1);
    assert.deepEqual(fit.allocations, []);
});
check('free room is used round robin, least loaded first', () => {
    const fit = fitAllocation([partner(1, 10, 4, 0), partner(2, 10, 0, 1), partner(3, 10, 0, 0)], 5);
    assert.equal(fit.shortfall, 0);
    assert.deepEqual(fit.allocations, [
        { idProjectPartners: 1, units: 1 },
        { idProjectPartners: 2, units: 2 },
        { idProjectPartners: 3, units: 2 },
    ]);
});
check('a request that fits stays where it is', () => {
    const fit = fitAllocation([partner(1, 5, 0, 0), partner(2, 5, 0, 0)], 3, [{ idProjectPartners: 2, units: 3 }]);
    assert.deepEqual(fit.allocations, [{ idProjectPartners: 2, units: 3 }]);
    assert.equal(fit.moved, 0);
});
check('a request into held room is moved to free room, not spilled', () => {
    const fit = fitAllocation([partner(1, 5, 0, 4), partner(2, 5, 0, 0)], 3, [{ idProjectPartners: 1, units: 3 }]);
    assert.deepEqual(fit.allocations, [{ idProjectPartners: 1, units: 1 }, { idProjectPartners: 2, units: 2 }]);
    assert.equal(fit.moved, 2);
    assert.equal(fit.shortfall, 0);
});
check("keepWithin 'confirmed' no longer spills either", () => {
    const fit = fitAllocation([partner(1, 5, 0, 5)], 1, [], { keepWithin: 'confirmed' });
    assert.equal(fit.shortfall, 1);
});
check('capacity 0 means no limit', () => {
    const fit = fitAllocation([partner(1, 0, 50, 50)], 7);
    assert.deepEqual(fit.allocations, [{ idProjectPartners: 1, units: 7 }]);
});
check('units left counts holds', () => {
    assert.equal(unitsLeft({ capacity: 10, confirmed: 4, pending: 3 }), 3);
    assert.equal(unitsLeft({ capacity: 0, confirmed: 4, pending: 3 }), null);
});

console.log(`\n${passed} checks passed.`);
