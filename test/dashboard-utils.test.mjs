import assert from "node:assert/strict";

import {
  calculateDashboardStats,
  filterDashboardUsers,
  getActiveCountForTicket,
  isActiveRegistration,
} from "../utils/dashboard.mjs";

const users = [
  {
    id: 1,
    firstname: "Ada",
    lastname: "Lovelace",
    email: "ada@example.com",
    status: "confirmed",
    ticket: "fullpass",
    level: "int1",
    price: "245",
    donation: "10",
  },
  {
    id: 2,
    firstname: "Grace",
    lastname: "Hopper",
    email: "grace@example.com",
    status: "waitinglist",
    ticket: "fullpass",
    level: "int1",
    price: "245",
    donation: "20",
  },
  {
    id: 3,
    firstname: "Katherine",
    lastname: "Johnson",
    email: "kat@example.com",
    status: "canceled",
    ticket: "partyPass",
    level: "",
    price: "145",
    donation: "5",
  },
  {
    id: 4,
    firstname: "Mary",
    lastname: "Jackson",
    email: "mary@example.com",
    status: "registered",
    ticket: "fullpass",
    level: "int2",
    price: "245",
    donation: "",
  },
];

function test(name, callback) {
  callback();
  console.log(`ok - ${name}`);
}

test("active registrations exclude waiting list and canceled/out users", () => {
  assert.equal(isActiveRegistration(users[0]), true);
  assert.equal(isActiveRegistration(users[1]), false);
  assert.equal(isActiveRegistration(users[2]), false);
});

test("dashboard stats count active capacity and active money only", () => {
  assert.deepEqual(calculateDashboardStats(users), {
    total: 4,
    active: 2,
    confirmed: 1,
    waitinglist: 1,
    canceled: 1,
    revenue: 490,
    donation: 10,
  });
});

test("dashboard filtering searches core attendee fields and filters status", () => {
  const result = filterDashboardUsers(users, {
    search: "hopper",
    status: "waitinglist",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].email, "grace@example.com");
});

test("active ticket count only includes active users for the ticket level", () => {
  assert.equal(getActiveCountForTicket(users, "int1"), 1);
  assert.equal(getActiveCountForTicket(users, "int2"), 1);
});
