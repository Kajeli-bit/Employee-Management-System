import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  clearTestDb,
  connectTestDb,
  createReq,
  createRes,
  disconnectTestDb,
} from "./helpers/harness.js";
import { makeStaff, seedOrganisation } from "./helpers/fixtures.js";
import {
  addEmployee,
  updateEmployee,
} from "../controllers/employeeController.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";

// Only Clerk is doubled. The controller, Mongoose models and a real in-memory
// database all run as they do in production.
const makeClerk = () => {
  const state = { created: null, emailAddresses: [] };
  const users = new Map();

  return {
    state,
    users: {
      getUserList: async ({ emailAddress = [] } = {}) => ({
        data: [...users.values()].filter((candidate) =>
          candidate.emailAddresses.some((address) =>
            emailAddress.some(
              (email) => email.toLowerCase() === address.emailAddress.toLowerCase()
            )
          )
        ),
      }),
      createUser: async (params) => {
        state.created = params;
        const id = `clerk_test_${params.emailAddress[0].split("@")[0]}`;
        const emailAddresses = params.emailAddress.map((emailAddress, index) => ({
          id: `${id}_email_${index}`,
          emailAddress,
          verification: { status: "unverified" },
        }));
        const created = {
          id,
          primaryEmailAddressId: emailAddresses[0]?.id,
          emailAddresses,
        };
        users.set(id, created);
        return created;
      },
      getUser: async (id) => users.get(id),
      deleteUser: async (id) => users.delete(id),
    },
    emailAddresses: {
      createEmailAddress: async ({ userId, emailAddress }) => {
        const address = {
          id: `${userId}_email_${users.get(userId).emailAddresses.length}`,
          emailAddress,
          verification: { status: "unverified" },
        };
        users.get(userId).emailAddresses.push(address);
        state.emailAddresses.push(address);
        return address;
      },
      deleteEmailAddress: async (id) => {
        state.emailAddresses = state.emailAddresses.filter((address) => address.id !== id);
      },
    },
  };
};

before(connectTestDb);
after(disconnectTestDb);

beforeEach(clearTestDb);

const add = async ({ actor, body, clerk }) => {
  const res = createRes();

  await addEmployee(createReq({ user: actor, body }), res, { clerk });

  return res;
};

const hrActor = async (companyId, departmentId, headId) => {
  const hr = await makeStaff({
    companyId,
    department: departmentId,
    createdBy: headId,
    role: "hr",
    name: "HR Manager",
    employeeId: "EMP-HR-1",
  });

  return hr.user;
};

test("name, work email and phone are enough to add a worker", async () => {
  const { company, finance, head } = await seedOrganisation();
  const actor = await hrActor(company._id, finance._id, head._id);
  const clerk = makeClerk();

  const res = await add({
    actor,
    clerk,
    body: {
      name: "Amina Juma",
      email: "Amina.Juma@Nilric.co.tz",
      phone: "+255 712 345 678",
    },
  });

  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.equal(res.body.role, "worker");
  assert.equal(res.body.employeeEmail, "amina.juma@nilric.co.tz");
  assert.ok(clerk.state.created, "a Clerk login is still created");

  const user = await User.findOne({ email: "amina.juma@nilric.co.tz" });

  assert.ok(user);
  assert.equal(user.name, "Amina Juma");
  assert.equal(user.role, "worker");
  assert.equal(user.username, "amina.juma", "username comes from the email");
  assert.equal(user.designation, "Worker");
  assert.equal(user.dob, undefined);

  const employee = await Employee.findOne({ userId: user._id });

  assert.ok(employee);
  assert.equal(employee.phone, "+255 712 345 678");
  assert.equal(employee.department, null, "placement is optional");
  assert.equal(employee.salary, undefined, "pay can be agreed later");
  assert.match(employee.employeeId, /^NIL-\d{2}-\d{4}$/);
  assert.equal(res.body.employeeId, employee.employeeId);
});

test("an optional personal email is attached as an unverified secondary login", async () => {
  const { company, finance, head } = await seedOrganisation();
  const actor = await hrActor(company._id, finance._id, head._id);
  const clerk = makeClerk();

  const res = await add({
    actor,
    clerk,
    body: {
      name: "Amina Juma",
      email: "amina@nilric.co.tz",
      personalEmail: " Amina@gmail.com ",
      phone: "+255 712 345 678",
    },
  });

  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.equal(res.body.personalEmail, "amina@gmail.com");
  assert.equal(res.body.personalEmailVerificationRequired, true);

  const user = await User.findOne({ email: "amina@nilric.co.tz" });
  assert.equal(user.personalEmail, "amina@gmail.com");
  assert.equal(clerk.state.emailAddresses[0].emailAddress, "amina@gmail.com");
  assert.equal(clerk.state.emailAddresses[0].verification.status, "unverified");
});

test("rejects a personal email already assigned to another EMS account", async () => {
  const { company, finance, head } = await seedOrganisation();
  const actor = await hrActor(company._id, finance._id, head._id);
  const clerk = makeClerk();
  await User.create({
    name: "Existing User",
    username: "existing.user",
    email: "existing@nilric.co.tz",
    personalEmail: "shared@gmail.com",
    companyId: company._id,
    role: "worker",
  });

  const res = await add({
    actor,
    clerk,
    body: {
      name: "Amina Juma",
      email: "amina@nilric.co.tz",
      personalEmail: "shared@gmail.com",
      phone: "+255 712 345 678",
    },
  });

  assert.equal(res.statusCode, 400);
  assert.equal(clerk.state.created, null);
  assert.equal(await User.countDocuments({ email: "amina@nilric.co.tz" }), 0);
});

test("a generated username does not collide with an existing one", async () => {
  const { company, finance, head } = await seedOrganisation();
  const actor = await hrActor(company._id, finance._id, head._id);
  const clerk = makeClerk();

  await User.create({
    name: "Amina Juma",
    username: "amina.juma",
    email: "someone.else@nilric.co.tz",
    companyId: company._id,
    role: "worker",
  });

  const res = await add({
    actor,
    clerk,
    body: {
      name: "Amina Juma",
      email: "amina.juma@nilric.co.tz",
      phone: "0712345678",
    },
  });

  assert.equal(res.statusCode, 201, JSON.stringify(res.body));

  const user = await User.findOne({ email: "amina.juma@nilric.co.tz" });

  assert.equal(user.username, "amina.juma2");
});

test("a username and staff ID typed by HR are kept", async () => {
  const { company, finance, head } = await seedOrganisation();
  const actor = await hrActor(company._id, finance._id, head._id);
  const clerk = makeClerk();

  const res = await add({
    actor,
    clerk,
    body: {
      name: "Amina Juma",
      email: "amina@nilric.co.tz",
      phone: "0712345678",
      username: "amina.j",
      employeeId: "NIL-26-7777",
    },
  });

  assert.equal(res.statusCode, 201, JSON.stringify(res.body));

  const user = await User.findOne({ email: "amina@nilric.co.tz" });
  const employee = await Employee.findOne({ userId: user._id });

  assert.equal(user.username, "amina.j");
  assert.equal(employee.employeeId, "NIL-26-7777");
});

test("rejects a personal email that matches the work email", async () => {
  const { company, finance, head } = await seedOrganisation();
  const actor = await hrActor(company._id, finance._id, head._id);
  const clerk = makeClerk();

  const res = await add({
    actor,
    clerk,
    body: {
      name: "Amina Juma",
      email: "amina@nilric.co.tz",
      personalEmail: "AMINA@NILRIC.CO.TZ",
      phone: "0712345678",
    },
  });

  assert.equal(res.statusCode, 400);
  assert.equal(clerk.state.created, null);
  assert.equal(await User.countDocuments({ email: "amina@nilric.co.tz" }), 0);
});

test("the phone number is required and nothing is saved without it", async () => {
  const { company, finance, head } = await seedOrganisation();
  const actor = await hrActor(company._id, finance._id, head._id);
  const clerk = makeClerk();

  const res = await add({
    actor,
    clerk,
    body: { name: "Amina Juma", email: "amina@nilric.co.tz" },
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /phone/);
  assert.equal(await User.countDocuments({ email: "amina@nilric.co.tz" }), 0);
  assert.equal(await Employee.countDocuments({}), 1, "only the HR record exists");
  assert.equal(clerk.state.created, null);
});

test("HR cannot appoint another HR account", async () => {
  const { company, finance, head } = await seedOrganisation();
  const actor = await hrActor(company._id, finance._id, head._id);
  const clerk = makeClerk();

  const res = await add({
    actor,
    clerk,
    body: {
      name: "Second HR",
      email: "second.hr@nilric.co.tz",
      phone: "0712345678",
      role: "hr",
    },
  });

  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /below your role/i);
  assert.equal(clerk.state.created, null);
});

test("the Managing Director can assign HR to an existing worker", async () => {
  const { company, finance, head } = await seedOrganisation();
  const { user: worker, employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    role: "worker",
    createdBy: head._id,
    employeeId: "EMP-ROLE-1",
  });
  const res = createRes();

  await updateEmployee(
    createReq({
      user: head,
      params: { id: employee._id.toString() },
      body: { role: "hr" },
    }),
    res
  );

  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.role, "hr");
  assert.equal((await User.findById(worker._id)).role, "hr");
});

test("HR can edit a worker but cannot assign HR or Managing Director", async () => {
  const { company, finance, head } = await seedOrganisation();
  const actor = await hrActor(company._id, finance._id, head._id);
  const { user: worker, employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    role: "worker",
    createdBy: head._id,
    employeeId: "EMP-ROLE-2",
  });

  const update = async (role) => {
    const res = createRes();

    await updateEmployee(
      createReq({
        user: actor,
        params: { id: employee._id.toString() },
        body: { role },
      }),
      res
    );

    return res;
  };

  const hrPromotion = await update("hr");
  assert.equal(hrPromotion.statusCode, 403);
  assert.match(hrPromotion.body.error, /cannot assign this role/i);

  const mdPromotion = await update("managing_director");
  assert.equal(mdPromotion.statusCode, 403);

  const workerUpdate = await update("worker");
  assert.equal(workerUpdate.statusCode, 200, JSON.stringify(workerUpdate.body));
  assert.equal((await User.findById(worker._id)).role, "worker");
});
