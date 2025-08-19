import mongoose from "mongoose";

const JobSchema = new mongoose.Schema({
  companyName: String,
  title: String,
  location: String,
  type: String,
  experience: String,
  description: String,
  skills: String,
  recruiterId: String,
  status: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active'
  },
  postedDate: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  applicants: [
    {
      name: String,
      email: String,
      userId: String,
      status: String,
    },
  ],
});

const Job = mongoose.models.Job || mongoose.model("Job", JobSchema);
export default Job;
