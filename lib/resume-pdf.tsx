import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 20,
    textAlign: "center",
  },
  name: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  contactRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    fontSize: 9,
    color: "#555",
  },
  contactItem: {
    marginRight: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    borderBottomStyle: "solid",
    paddingBottom: 4,
    marginBottom: 8,
    color: "#333",
  },
  summary: {
    fontSize: 10,
    color: "#333",
    lineHeight: 1.6,
  },
  experienceItem: {
    marginBottom: 12,
  },
  experienceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 2,
  },
  jobTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
  },
  dateRange: {
    fontSize: 9,
    color: "#777",
  },
  company: {
    fontSize: 10,
    color: "#555",
    marginBottom: 4,
  },
  bulletList: {
    paddingLeft: 14,
  },
  bullet: {
    fontSize: 9.5,
    marginBottom: 2,
    lineHeight: 1.5,
  },
  skillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  skillTag: {
    fontSize: 9,
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  highlightsList: {
    paddingLeft: 14,
  },
  highlight: {
    fontSize: 9.5,
    marginBottom: 3,
    lineHeight: 1.5,
  },
  educationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  educationLeft: {},
  educationDegree: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
  },
  educationDetail: {
    fontSize: 10,
    color: "#555",
  },
  educationYear: {
    fontSize: 9,
    color: "#777",
  },
});

type ResumePdfProps = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  summary: string;
  workExperience: {
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    responsibilities: string[];
  }[];
  education: {
    degree: string;
    fieldOfStudy: string;
    institution: string;
    graduationYear: string;
  };
  skills: string[];
  highlights: string[];
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month] = dateStr.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthName = month ? months[parseInt(month, 10) - 1] : "";
  return monthName ? `${monthName} ${year}` : year || "";
}

export function ResumePdf({
  fullName,
  email,
  phone,
  location,
  linkedinUrl,
  portfolioUrl,
  summary,
  workExperience,
  education,
  skills,
  highlights,
}: ResumePdfProps) {
  const contactParts = [location, phone, email].filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{fullName}</Text>
          <View style={styles.contactRow}>
            {contactParts.map((part, i) => (
              <Text key={i} style={styles.contactItem}>
                {part}
              </Text>
            ))}
            {linkedinUrl && (
              <Text style={styles.contactItem}>{linkedinUrl}</Text>
            )}
            {portfolioUrl && (
              <Text style={styles.contactItem}>{portfolioUrl}</Text>
            )}
          </View>
        </View>

        {/* Professional Summary */}
        {summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Summary</Text>
            <Text style={styles.summary}>{summary}</Text>
          </View>
        )}

        {/* Career Highlights */}
        {highlights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Highlights</Text>
            <View style={styles.highlightsList}>
              {highlights.map((h, i) => (
                <Text key={i} style={styles.highlight}>
                  {`•  ${h}`}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Work Experience */}
        {workExperience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {workExperience.map((exp, i) => {
              const start = formatDate(exp.startDate);
              const end = exp.isCurrent ? "Present" : formatDate(exp.endDate);
              const dateStr = start
                ? end ? `${start} — ${end}` : start
                : end || "";
              return (
                <View key={i} style={styles.experienceItem}>
                  <View style={styles.experienceHeader}>
                    <Text style={styles.jobTitle}>{exp.title}</Text>
                    <Text style={styles.dateRange}>{dateStr}</Text>
                  </View>
                  <Text style={styles.company}>{exp.company}</Text>
                  <View style={styles.bulletList}>
                    {exp.responsibilities.map((bullet, j) => (
                      <Text key={j} style={styles.bullet}>
                        {`•  ${bullet}`}
                      </Text>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Education */}
        {(education.degree || education.fieldOfStudy || education.institution) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            <View style={styles.educationRow}>
              <View style={styles.educationLeft}>
                <Text style={styles.educationDegree}>
                  {education.degree}
                  {education.fieldOfStudy ? ` — ${education.fieldOfStudy}` : ""}
                </Text>
                <Text style={styles.educationDetail}>
                  {education.institution}
                </Text>
              </View>
              {education.graduationYear && (
                <Text style={styles.educationYear}>
                  {education.graduationYear}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsContainer}>
              {skills.map((skill, i) => (
                <Text key={i} style={styles.skillTag}>
                  {skill}
                </Text>
              ))}
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
