function getPeopleData() {
  // Define GraphQL query
  var graphQLQuery = `
      query People {
        people(
          filters: {
            home_committee: lc_id
            registered: { from: "2024-02-01T00:00:00Z", to: "2025-01-31T23:59:59Z" }
          }
          pagination: { per_page: 2000 }
        ) {
          data {
            id
            full_name
            gender
            phone
            email
            created_at
            is_aiesecer
            person_profile {
              backgrounds {
                name
              }
              selected_programmes
            }
            opportunity_applications_count
            status
            home_lc {
              full_name
            }
            lc_alignment {
              keywords
            }
            referral_type
          }
        }
      }
    `;

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ query: graphQLQuery }),
  };

  var url = "https://gis-api.aiesec.org/graphql?access_token={access_token}";
  var response = UrlFetchApp.fetch(url, options);

  // Parse response
  var responseData = JSON.parse(response.getContentText());
  var peopleData = responseData.data.people.data; // Accessing 'data' field within 'people'

  // Get Google Sheets spreadsheet
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName("📱 sign ups");

  // Write data
  var data = peopleData.map(function (person) {
    // Log the entire person object
    console.log("Person:", person);

    // Check if person_profile exists and selected_programmes is present
    var selectedProgrammes =
      person.person_profile && person.person_profile.selected_programmes
        ? person.person_profile.selected_programmes
        : [];

    // Map selected_programmes to abbreviations
    var programmeAbbreviations = selectedProgrammes.map(function (programmeId) {
      switch (programmeId) {
        case 7:
          return "GV";
        case 8:
          return "GTa";
        case 9:
          return "GTe";
        default:
          return "";
      }
    });

    if (!person.phone) {
      // Define mutation query
      var mutationQuery = `
          mutation UpdatePerson {
            updatePerson(
                id: ${person.id}
                person: {
                    meta: { allow_phone_communication: "true", allow_email_communication: "true" }
                }
            ) {
                full_name
                email
                phone
            }
          }
        `;

      // Execute mutation query to update phone number
      var mutationOptions = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ query: mutationQuery }),
      };

      var mutationResponse = UrlFetchApp.fetch(url, mutationOptions);
      var mutationData = JSON.parse(mutationResponse.getContentText());

      // Update person's phone number if mutation was successful
      if (mutationData.data && mutationData.data.updatePerson) {
        person.phone = mutationData.data.updatePerson.phone;
      }
    }

    return [
      person.id,
      person.full_name,
      person.gender,
      person.phone,
      person.email,
      person.created_at,
      person.is_aiesecer,
      person.person_profile
        ? person.person_profile.backgrounds
            .map(function (background) {
              return background.name;
            })
            .join(", ")
        : "", // Handle null values
      person.opportunity_applications_count,
      person.status,
      person.home_lc ? person.home_lc.full_name : "", // Handle null values
      programmeAbbreviations.join(", "), // Join multiple abbreviations with a comma
      person.lc_alignment ? person.lc_alignment.keywords : "", // Handle null values and ensure lc_alignment.keywords is an array
      person.referral_type,
    ];
  });
  sheet.getRange("B7:O" + (data.length + 6)).setValues(data); // Adjusted range
}
