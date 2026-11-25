
import { useState } from "react";
import "./App.css";

const initialForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  photo: "",
};

function App() {
  const [form, setForm] = useState(initialForm);
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Upload profile picture
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be smaller than 5 MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        photo: reader.result,
      }));
    };

    reader.onerror = () => {
      alert("Could not load the image.");
    };

    reader.readAsDataURL(file);
  };

  // Remove profile picture
  const removePhoto = () => {
    setForm((prev) => ({
      ...prev,
      photo: "",
    }));

    const fileInput = document.getElementById("profile-photo");
    if (fileInput) fileInput.value = "";
  };

  // Add or update contact
  const handleSubmit = (e) => {
    e.preventDefault();

    const contactData = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      photo: form.photo,
    };

    if (
      !contactData.name ||
      !contactData.phone ||
      !contactData.email ||
      !contactData.address
    ) {
      alert("Please fill in all fields.");
      return;
    }

    if (editingId !== null) {
      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === editingId
            ? { ...contact, ...contactData }
            : contact
        )
      );
    } else {
      setContacts((prev) => [
        ...prev,
        {
          id: Date.now(),
          ...contactData,
        },
      ]);
    }

    setForm({ ...initialForm });
    setEditingId(null);

    const fileInput = document.getElementById("profile-photo");
    if (fileInput) fileInput.value = "";
  };

  // Edit contact
  const handleEdit = (contact) => {
    setForm({
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      address: contact.address,
      photo: contact.photo || "",
    });

    setEditingId(contact.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Delete contact
  const handleDelete = (id) => {
    if (!window.confirm("Do you want to delete this contact?")) {
      return;
    }

    setContacts((prev) =>
      prev.filter((contact) => contact.id !== id)
    );

    if (editingId === id) {
      setForm({ ...initialForm });
      setEditingId(null);
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setForm({ ...initialForm });
    setEditingId(null);

    const fileInput = document.getElementById("profile-photo");
    if (fileInput) fileInput.value = "";
  };

  // Search contacts
  const filteredContacts = contacts.filter((contact) => {
    const query = search.toLowerCase().trim();

    return (
      contact.name.toLowerCase().includes(query) ||
      contact.phone.toLowerCase().includes(query) ||
      contact.email.toLowerCase().includes(query) ||
      contact.address.toLowerCase().includes(query)
    );
  });

  return (
    <div className="page">
      <main className="contact-container">

        {/* Header */}
        <header className="app-header">
          <h1>Contact Manager</h1>
          <p>Manage your contacts easily</p>
        </header>

        {/* Search */}
        <section className="search-section">
          <input
            type="search"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </section>

        {/* Contact Form */}
        <section className="form-section">
          <h2>
            {editingId !== null ? "Edit Contact" : "Add Contact"}
          </h2>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              name="name"
              placeholder="Enter Name"
              value={form.name}
              onChange={handleChange}
              required
            />

            <input
              type="tel"
              name="phone"
              placeholder="Enter Phone Number"
              value={form.phone}
              onChange={handleChange}
              required
            />

            <input
              type="email"
              name="email"
              placeholder="Enter Email"
              value={form.email}
              onChange={handleChange}
              required
            />

            <input
              type="text"
              name="address"
              placeholder="Enter Address"
              value={form.address}
              onChange={handleChange}
              required
            />

            {/* Profile Picture */}
            <label className="photo-label" htmlFor="profile-photo">
              Upload Profile Picture
            </label>

            <input
              id="profile-photo"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
            />

            {/* Photo Preview */}
            {form.photo && (
              <div className="photo-preview">
                <img
                  src={form.photo}
                  alt="Profile Preview"
                />

                <button
                  type="button"
                  onClick={removePhoto}
                >
                  Remove Photo
                </button>
              </div>
            )}

            {/* Submit */}
            <button className="add-button" type="submit">
              {editingId !== null
                ? "Update Contact"
                : "Add Contact"}
            </button>

            {editingId !== null && (
              <button
                className="cancel-button"
                type="button"
                onClick={handleCancel}
              >
                Cancel
              </button>
            )}
          </form>
        </section>

        {/* Contact List */}
        <section className="list-section">
          <h2>Contact List</h2>

          {filteredContacts.length === 0 ? (
            <div className="empty-message">
              {search.trim()
                ? "No contacts found."
                : "No contacts added yet!"}
            </div>
          ) : (
            <div className="contact-list">
              {filteredContacts.map((contact) => (
                <article
                  className="contact-card"
                  key={contact.id}
                >
                  <div className="contact-info">

                    {/* Profile Picture and Name */}
                    <div className="contact-profile">
                      {contact.photo ? (
                        <img
                          className="profile-picture"
                          src={contact.photo}
                          alt={contact.name}
                        />
                      ) : (
                        <div className="profile-picture profile-placeholder">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <h3>{contact.name}</h3>
                    </div>

                    {/* Details */}
                    <p>
                      <strong>Phone:</strong> {contact.phone}
                    </p>

                    <p>
                      <strong>Email:</strong> {contact.email}
                    </p>

                    <p>
                      <strong>Address:</strong> {contact.address}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="contact-actions">
                    <button
                      type="button"
                      className="edit-button"
                      onClick={() => handleEdit(contact)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="delete-button"
                      onClick={() => handleDelete(contact.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="contact-count">
            Total Contacts: {contacts.length}
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;