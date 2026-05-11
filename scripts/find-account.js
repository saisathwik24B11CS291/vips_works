require('dotenv').config();
const mongoose = require('mongoose');
const Worker = require('../models/Worker');
const Employer = require('../models/Employer');

function normalizeEmail(value){
    return String(value || '').trim().toLowerCase();
}

function makeExactRegex(value){
    const escaped = normalizeEmail(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { $regex: `^\\s*${escaped}\\s*$`, $options: 'i' };
}

async function main(){
    const identifier = process.argv[2];
    if(!identifier){
        console.error('Usage: node scripts/find-account.js user@gmail.com');
        process.exit(1);
    }
    if(!process.env.MONGODB_URI){
        console.error('MONGODB_URI is missing.');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    const exact = makeExactRegex(identifier);
    const query = { $or: [{ email: exact }, { username: exact }] };
    const worker = await Worker.findOne(query).select('username email role').lean();
    const employer = await Employer.findOne(query).select('username email role').lean();

    console.log(JSON.stringify({
        searched: normalizeEmail(identifier),
        worker: worker ? { id: worker._id, username: worker.username, email: worker.email, role: worker.role } : null,
        employer: employer ? { id: employer._id, username: employer.username, email: employer.email, role: employer.role } : null
    }, null, 2));

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
});
