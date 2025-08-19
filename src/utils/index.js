import qs from "query-string";

export const recruiterOnboardFormControls = [
  {
    label: "Name",
    name: "name",
    placeholder: "Your name",
    componentType: "input",
    required: true,
  },
  {
    label: "Company Name",
    name: "companyName",
    placeholder: "Your company name",
    componentType: "input",
    required: true,
  },
  {
    label: "Company Role",
    name: "companyRole",
    placeholder: "Your company role",
    componentType: "input",
    required: true,
  },
  {
    label: "Email",
    name: "email",
    placeholder: "Your work email",
    componentType: "input",
    required: true,
  },
  {
    label: "Phone Number",
    name: "phoneNumber",
    placeholder: "Your phone number",
    componentType: "input",
    required: true,
  },
];

export const initialRecruiterFormData = {
  name: "",
  companyName: "",
  companyRole: "",
  email: "",
  phoneNumber: "",
};

export const candidateOnboardFormControls = [
  {
    label: "Resume",
    name: "resume",
    componentType: "file",
    required: true,
  },
  {
    label: "Name",
    name: "name",
    placeholder: "Your name",
    componentType: "input",
    required: true,
  },
  {
    label: "Email",
    name: "email",
    placeholder: "Your email",
    componentType: "input",
    required: true,
  },
  {
    label: "Phone Number",
    name: "phoneNumber",
    placeholder: "Your phone number",
    componentType: "input",
    required: true,
  },
  {
    label: "Prefered Job Location",
    name: "preferedJobLocation",
    placeholder: "Your preferred job location",
    componentType: "input",
  },
  {
    label: "Expected Salary in MYR",
    name: "currentSalary",
    placeholder: "Your expected salary in MYR",
    componentType: "input",
  },
  {
    label: "Notice Period",
    name: "noticePeriod",
    placeholder: "Your notice period",
    componentType: "input",
  },
  {
    label: "Skills",
    name: "skills",
    placeholder: "Your skills",
    componentType: "input",
  },
  {
    label: "Total Experience",
    name: "totalExperience",
    placeholder: "Describe your working experience",
    componentType: "input",
  },
  {
    label: "College",
    name: "college",
    placeholder: "Your college",
    componentType: "input",
  },
  {
    label: "Graduated Year",
    name: "graduatedYear",
    placeholder: "Your graduated year",
    componentType: "input",
  },
  {
    label: "Linkedin Profile",
    name: "linkedinProfile",
    placeholder: "Your linkedin profile",
    componentType: "input",
  },
  {
    label: "Github Profile",
    name: "githubProfile",
    placeholder: "Your github profile",
    componentType: "input",
  },
];

export const initialCandidateFormData = {
  resume: "",
  name: "",
  email: "",
  phoneNumber: "",
  preferedJobLocation: "",
  currentSalary: "",
  noticePeriod: "",
  skills: "",
  totalExperience: "",
  college: "",
  graduatedYear: "",
  linkedinProfile: "",
  githubProfile: "",
};

export const initialCandidateAccountFormData = {
  resume: "",
  resumeOriginalName: "",
  name: "",
  email: "",
  phoneNumber: "",
  preferedJobLocation: "",
  currentSalary: "",
  noticePeriod: "",
  skills: "",
  totalExperience: "",
  college: "",
  graduatedYear: "",
  linkedinProfile: "",
  githubProfile: "",
};

export const postNewJobFormControls = [
  {
    label: "Company Name",
    name: "companyName",
    placeholder: "Company Name",
    componentType: "input",
    disabled: true,
  },
  {
    label: "Title",
    name: "title",
    placeholder: "Job Title",
    componentType: "input",
  },
  {
    label: "Type",
    name: "type",
    placeholder: "Job Type",
    componentType: "input",
  },
  {
    label: "Location",
    name: "location",
    placeholder: "Job Location",
    componentType: "input",
  },
  {
    label: "Experience",
    name: "experience",
    placeholder: "Experience",
    componentType: "input",
  },
  {
    label: "Description",
    name: "description",
    placeholder: "Description",
    componentType: "input",
  },
  {
    label: "Skills",
    name: "skills",
    placeholder: "Skills",
    componentType: "input",
  },
];

export const initialPostNewJobFormData = {
  companyName: "",
  title: "",
  type: "",
  location: "",
  experience: "",
  description: "",
  skills: "",
};

export const filterMenuDataArray = [
  {
    id: "companyName",
    label: "Company Name",
  },
  {
    id: "title",
    label: "Title",
  },
  {
    id: "type",
    label: "Type",
  },
  {
    id: "location",
    label: "Location",
  },
];

export function formUrlQuery({ params, dataToAdd }) {
  let currentURL = qs.parse(params);

  if (Object.keys(dataToAdd).length > 0) {
    Object.keys(dataToAdd).map((key) => {
      if (dataToAdd[key].length === 0) delete currentURL[key];
      else currentURL[key] = dataToAdd[key].join(",");
    });
  }

  return qs.stringifyUrl(
    {
      url: window.location.pathname,
      query: currentURL,
    },
    {
      skipNull: true,
    }
  );
}

export const membershipPlans = [
  {
    heading: "Tier 1",
    price: 100,
    type: "basic",
  },
  {
    heading: "Tier 2",
    price: 1000,
    type: "teams",
  },
  {
    heading: "Tier 3",
    price: 5000,
    type: "enterprise",
  },
];
