import React, { useState, useEffect } from "react";
import {
  unstable_Form as Form,
  unstable_FormMessage as FormMessage,
  unstable_FormRadioGroup as FormRadioGroup,
  unstable_FormRadio as FormRadio,
  unstable_FormInput as FormInput,
  unstable_FormSubmitButton as FormSubmitButton,
  unstable_FormCheckbox as FormCheckbox,
  unstable_FormLabel as FormLabel,
} from "reakit/Form";
import SkeletonComponent from "../Skeleton/Skeleton";

import classNames from "classnames";

import InfoModal from "../InfoModal/InfoModal";
import { levelsToShow, compettionsInfo } from "../../utils/functions";
import styles from "./RegistrationForm.module.scss";
import Card from "../Card/Card";
import countries from "../../utils/countries";
import { useDialogState } from "reakit/Dialog";
const flatProps = {
  options: countries.map((option) => option.title),
};

export default function FoodForm({ form, tickets, isClicked }) {
  const dialog = useDialogState();
  const handleTicket = (ticket) => {
    if (ticket === 1) {
      form.update("ticket", "fullpass");
    } else {
      form.update("ticket", "partyPass");
      form.update("role", "");
      form.update("level", "");
    }
  };

  const getTicketCapacity = (ticketName) => {
    if (ticketName === "partyPass") {
      const [ticket] = tickets.filter(({ name }) => name === ticketName);
      return ticket["capacity"];
    }
  };
  function initPayPalButton() {
    var shipping = 0;
    var itemOptions = document.querySelector(
      "#smart-button-container #item-options"
    );
    var quantity = parseInt();
    var quantitySelect = document.querySelector(
      "#smart-button-container #quantitySelect"
    );
    if (!isNaN(quantity)) {
      quantitySelect.style.visibility = "visible";
    }
    var orderDescription = "";
    if (orderDescription === "") {
      orderDescription = "Item";
    }
    paypal
      .Buttons({
        style: {
          shape: "rect",
          color: "gold",
          layout: "vertical",
          label: "buynow",
        },
        createOrder: function (data, actions) {
          var selectedItemDescription =
            itemOptions.options[itemOptions.selectedIndex].value;
          var selectedItemPrice = parseFloat(
            itemOptions.options[itemOptions.selectedIndex].getAttribute("price")
          );
          var tax =
            0 === 0 || false ? 0 : selectedItemPrice * (parseFloat(0) / 100);
          if (quantitySelect.options.length > 0) {
            quantity = parseInt(
              quantitySelect.options[quantitySelect.selectedIndex].value
            );
          } else {
            quantity = 1;
          }

          tax *= quantity;
          tax = Math.round(tax * 100) / 100;
          var priceTotal =
            quantity * selectedItemPrice + parseFloat(shipping) + tax;
          priceTotal = Math.round(priceTotal * 100) / 100;
          var itemTotalValue =
            Math.round(selectedItemPrice * quantity * 100) / 100;

          return actions.order.create({
            purchase_units: [
              {
                description: orderDescription,
                amount: {
                  currency_code: "USD",
                  value: priceTotal,
                  breakdown: {
                    item_total: {
                      currency_code: "USD",
                      value: itemTotalValue,
                    },
                    shipping: {
                      currency_code: "USD",
                      value: shipping,
                    },
                    tax_total: {
                      currency_code: "USD",
                      value: tax,
                    },
                  },
                },
                items: [
                  {
                    name: selectedItemDescription,
                    unit_amount: {
                      currency_code: "USD",
                      value: selectedItemPrice,
                    },
                    quantity: quantity,
                  },
                ],
              },
            ],
          });
        },
        onApprove: function (data, actions) {
          return actions.order.capture().then(function (orderData) {
            // Full available details
            console.log(
              "Capture result",
              orderData,
              JSON.stringify(orderData, null, 2)
            );

            // Show a success message within this page, e.g.
            const element = document.getElementById("paypal-button-container");
            element.innerHTML = "";
            element.innerHTML = "<h3>Thank you for your payment!</h3>";

            // Or go to another URL:  actions.redirect('thank_you.html');
          });
        },
        onError: function (err) {
          console.log(err);
        },
      })
      .render("#paypal-button-container");
  }
  // initPayPalButton();
  const disabled = (value) =>
    (form.values.role === "follow" &&
      (value === "trumpet" ||
        value === "drums" ||
        value === "guitar" ||
        value === "saxophone")) ||
    (form.values.role === "lead" &&
      (value === "trumpet" || value === "guitar" || value === "saxophone"));

  return (
    <>
      {!isClicked && (
        <Form className={styles.container} {...form}>
          <h3 className={styles.personalTitle}>Your Personal Data:</h3>

          <FormInput
            required
            {...form}
            label="First Name"
            defaultValue={form.values.firstName}
            className={styles.input}
            name="firstName"
            placeholder="first name"
          />
          <FormMessage
            className={styles.errorMessage}
            {...form}
            name="firstName"
          />
          <FormInput
            {...form}
            required
            label="Last Name"
            defaultValue={form.values.lastName}
            className={styles.input}
            name="lastName"
            placeholder="last name"
          />
          <FormMessage
            className={styles.errorMessage}
            {...form}
            name="lastName"
          />
          <FormInput
            {...form}
            required
            label="E-mail"
            className={styles.input}
            defaultValue={form.values.email}
            name="email"
            placeholder="email"
          />
          <FormMessage className={styles.errorMessage} {...form} name="email" />

          <div className={styles.radioGroup}>
            <h4 className={styles.title}>
              Which day you wanto to have lunch at the Venue? <br></br>(You can
              choose both days):
              <span style={{ fontSize: "15px" }}>
                <br></br> (€12.50 per meal)
              </span>
            </h4>

            <label>
              <FormCheckbox {...form} name="lunch" value="saturday" /> Saturday
              Lunch
            </label>
            <label>
              <FormCheckbox {...form} name="lunch" value="sunday" /> Sunday
              Lunch
            </label>
          </div>

          <FormMessage className={styles.errorMessage} {...form} name="terms" />
          <FormSubmitButton
            disabled={isClicked}
            className={classNames(styles.button, {
              [styles.disabled]: isClicked,
            })}
            {...form}
          >
            Submit
          </FormSubmitButton>
        </Form>
      )}
      {isClicked && (
        <>
          <div id="smart-button-container">
            <div style="text-align: center;">
              <div style="margin-bottom: 1.25rem;">
                <p></p>
                {/* <select id="item-options">
                  <option value="One Day Lunch" price="12.50">
                    One Day Lunch - 12.50 USD
                  </option>
                  <option value="Two Days  Lunch" price="25.00">
                    Two Days Lunch - 25.00 USD
                  </option>
                  <option value="One Day Lunch with Donation" price="15.00">
                    One Day Lunch with Donation - 15.00 USD
                  </option>
                  <option value="Two Days Lunch with Donation" price="30.00">
                    Two Days Lunch with Donation - 30.00 USD
                  </option>
                </select> */}
                {/* <select style="visibility: hidden" id="quantitySelect"></select> */}
              </div>
              <div id="paypal-button-container"></div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
