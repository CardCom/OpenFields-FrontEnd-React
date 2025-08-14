import React, { type FormEvent, useRef, useEffect } from 'react';
import type { CheckoutFormProps, SubmitResult, DocumentData } from '../types';
import cardNumberCss from '../css/cardNumber.css?raw';
const CARDCOM_URL = import.meta.env.VITE_CARDCOM_URL || 'https://cardcom.solutions.co.il';


const CheckoutForm: React.FC<CheckoutFormProps> = ({ loadingRef, lowProfileCode, }) => {

  // Refs for form fields
  const cardOwnerNameRef = useRef<HTMLInputElement>(null);
  const cardOwnerEmailRef = useRef<HTMLInputElement>(null);
  const expirationMonthRef = useRef<HTMLInputElement>(null);
  const expirationYearRef = useRef<HTMLInputElement>(null);

  // Refs for iframes
  const masterRef = useRef<HTMLIFrameElement | null>(null);
  const cardNumberIframeRef = useRef<HTMLIFrameElement>(null);
  const cvvIframeRef = useRef<HTMLIFrameElement>(null);
  const googlePayIframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let iframesLoaded = 0;
    const totalIframes = 4; // master, cardNumber, cvv, googlePay

    // Toggle CSS classes for field validation styling
    const toggleFieldClass = (action: string, isValid: boolean, className: string) => {
      masterRef.current?.contentWindow?.postMessage(
        { action: isValid ? action.replace('add', 'remove') : action, className }, '*'
      );
    };

    // Check if all iframes have loaded before initializing CSS
    const checkIframesLoaded = () => {
      iframesLoaded++;
      if (iframesLoaded === totalIframes) {
        loadIframesCss();
      }
    };

    // Handle successful payment submission result
    const onSubmitResult = (data: SubmitResult) => {
      if (loadingRef.current) loadingRef.current.style.display = 'none';
      alert(data.IsSuccess ? data.Description : 'Deal failed');
    };

    // Handle payment processing errors
    const onError = (message: string) => {
      if (loadingRef.current) loadingRef.current.style.display = 'none';
      alert(message);
    };

    // Central message handler for all iframe communications
    const handleFrameMessages = (ev: MessageEvent) => {
      const msg = ev.data;
      if (!msg || !msg.action) return;

      switch (msg.action) {
        case 'HandleSubmit':
          onSubmitResult(msg.data);
          break;
        case 'HandleEror':
          onError(msg.message);
          break;
        case 'handleValidations':
          if (msg.field === 'cvv') toggleFieldClass('addCvvFieldClass', msg.isValid, 'invalid');
          if (msg.field === 'cardNumber') toggleFieldClass('addCardNumberFieldClass', msg.isValid, 'invalid');
          onValidation(msg.field, msg.isValid);
          break;
        case 'StartedGooglePaySubmit':
          //display loading indicator when Google Pay submit starts. 
          if (loadingRef.current) loadingRef.current.style.display = 'flex';
          break;
      }
    };

    // Initialize iframe styling and configuration
    const loadIframesCss = async () => {
      const cvvCssText = `body { margin:0; padding:0;} .cvvField { border:1px solid #ccc; border-radius:3px; height:39px; margin:0; padding:0 10px; width:165px; }.cvvField.invalid { border:1px solid #c01111; }input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; } input[type=number] { -moz-appearance:textfield; }`;
      const inlineCSS = `body { margin:0; padding:0; display:flex; }`;

      // Send initialization message to master iframe with styling and configuration
      const msg = {
        action: 'init',
        cardFieldCSS: cardNumberCss,
        cvvFieldCSS: cvvCssText,
        reCaptchaFieldCSS: inlineCSS,
        placeholder: '1111-2222-3333-4444',
        cvvPlaceholder: '123',
        lowProfileCode,
      };
      masterRef.current?.contentWindow?.postMessage(msg, '*');
    };

    // Add load event listeners to iframes
    const masterIframe = masterRef.current;
    const cardNumberIframe = cardNumberIframeRef.current;
    const cvvIframe = cvvIframeRef.current;
    const googlePayIframe = googlePayIframeRef.current;

    if (masterIframe) masterIframe.addEventListener('load', checkIframesLoaded);
    if (cardNumberIframe) cardNumberIframe.addEventListener('load', checkIframesLoaded);
    if (cvvIframe) cvvIframe.addEventListener('load', checkIframesLoaded);
    if (googlePayIframe) googlePayIframe.addEventListener('load', checkIframesLoaded);

    // Add message event listener
    window.addEventListener('message', handleFrameMessages);

    // Cleanup
    return () => {
      if (masterIframe) masterIframe.removeEventListener('load', checkIframesLoaded);
      if (cardNumberIframe) cardNumberIframe.removeEventListener('load', checkIframesLoaded);
      if (cvvIframe) cvvIframe.removeEventListener('load', checkIframesLoaded);
      if (googlePayIframe) googlePayIframe.removeEventListener('load', checkIframesLoaded);
      window.removeEventListener('message', handleFrameMessages);
    };
  }, [lowProfileCode, loadingRef]);

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (loadingRef.current) loadingRef.current.style.display = 'flex';

    // Prepare transaction data with form values and document details
    const formProps = {
      action: 'doTransaction',
      cardOwnerId: '000000000',
      cardOwnerName: cardOwnerNameRef.current?.value || '',
      cardOwnerEmail: cardOwnerEmailRef.current?.value || '',
      expirationMonth: expirationMonthRef.current?.value || '',
      expirationYear: expirationYearRef.current?.value || '',
      cardOwnerPhone: '054512345678',
      document: createDocument(),
      numberOfPayments: '1',
    };
    // Send transaction request to master iframe
    masterRef.current?.contentWindow?.postMessage(formProps, '*');
  };

  // Create document object for invoice/receipt generation
  const createDocument = (): DocumentData => {
    return {
      Name: "Cardcom",
      Email: "support@cardcom.solutions.co.il",
      IsSendByEmail: false,
      AddressLine1: "Harokmin 26",
      AddressLine2: "Azrieli Center",
      City: "Holon",
      Mobile: "054123465789",
      Phone: "03-9436100",
      Comments: "Your comments",
      IsVatFree: false,
      DepartmentId: 123,
      ExternalId: "external-id",
      IsAllowEditDocument: false,
      IsShowOnlyDocument: false,
      Language: "he",
      DocumentTypeToCreate: "Receipt", //see swagger for full list
      AdvancedDocumentDefinition: {
        IsAutoCreateUpdateAccount: "auto", //"true", "false", "auto"
        AccountForeignKey: "key",
        SiteUniqueId: "",
        AccountID: 1,
        IsLoadInfoFromAccountID: false
      },
      Products: [{
        ProductID: "ui-321",
        Description: "Description",
        Quantity: 1,
        UnitCost: 9.99,
        TotalLineCost: 9.99,
        IsVatFree: false
      }]
    }

  };

  // Send card owner details to master iframe for validation and prefill
  const setCardOwnerDetails = () => {
    const data = {
      cardOwnerName: cardOwnerNameRef.current?.value || '',
      cardOwnerEmail: cardOwnerEmailRef.current?.value || '',
      cardOwnerPhone: '054512345678',
    };
    masterRef.current?.contentWindow?.postMessage({ action: 'setCardOwnerDetails', data }, '*');
  }

  // Handle field validation feedback (can be extended for custom validation logic)
  const onValidation = (field: string, isValid: boolean) => {
    // Validation handling can be added here if needed
    console.log(`Field ${field} is ${isValid ? 'valid' : 'invalid'}`);
  };



  return (
    <div id="second-screen">
      <div className="container">
        <form id="form" onSubmit={handleFormSubmit}>
          <div className="row">
            <div className="col-50">
              <h3>Billing Address</h3>
              <label htmlFor="cname"><i className="fa fa-user"></i> Full Name</label>
              <input
                type="text"
                id="Name"
                name="fname"
                placeholder="John M. Doe"
              />
              <label htmlFor="cardOwnerEmail"><i className="fa fa-envelope"></i> Email</label>
              <input
                ref={cardOwnerEmailRef}
                type="text"
                id="cardOwnerEmail"
                name="email"
                placeholder="john@example.com"
                onBlur={setCardOwnerDetails}
              />
              <label htmlFor="adr"><i className="fa fa-address-card-o"></i> Address</label>
              <input type="text" id="adr" name="address" placeholder="542 W. 15th Street" />
              <label htmlFor="city"><i className="fa fa-institution"></i> City</label>
              <input type="text" id="city" name="city" placeholder="New York" />
              <div className="row">
                <div className="col-50">
                  <label htmlFor="state">State</label>
                  <input type="text" id="state" name="state" placeholder="NY" />
                </div>
                <div className="col-50">
                  <label htmlFor="zip">Zip</label>
                  <input type="text" id="zip" name="zip" placeholder="10001" />
                </div>
              </div>
              <input type="submit" id="submit-btn" className="btn" value="Submit Payment" />
            </div>
            <div className="col-50">
              <h3>Payment</h3>
              <label>Accepted Cards</label>
              <div className="icon-container">
                <i className="fa fa-cc-visa" style={{ color: 'navy' }}></i>
                <i className="fa fa-cc-amex" style={{ color: 'blue' }}></i>
                <i className="fa fa-cc-mastercard" style={{ color: 'red' }}></i>
                <i className="fa fa-cc-discover" style={{ color: 'orange' }}></i>
              </div>
              <label htmlFor="CardComMasterFrame">Name on Card</label>
              <input type="text" name="cardOwnerName" ref={cardOwnerNameRef} placeholder="John More Doe" onBlur={setCardOwnerDetails} />

              <label>Credit card number</label>
              <iframe
                ref={masterRef}
                id="CardComMasterFrame"
                name="CardComMasterFrame"
                src={`${CARDCOM_URL}/api/openfields/master`}
                style={{ display: 'block', width: 0, height: 0 }}
              />
              <iframe
                ref={cardNumberIframeRef}
                id="CardComCardNumber"
                name="CardComCardNumber"
                src={`${CARDCOM_URL}/api/openfields/cardNumber`}
                style={{ width: '100%', height: '57px' }}
              />

              <div className="expDate">
                <div className="expMonth">
                  <label htmlFor="expmonth">Exp Month</label>
                  <input
                    ref={expirationMonthRef}
                    type="text"
                    id="expirationMonth"
                    name="expirationMonth"
                    defaultValue="05"
                    placeholder="05"
                  />
                </div>
                <div className="expYear">
                  <label htmlFor="expyear">Exp Year</label>
                  <input
                    ref={expirationYearRef}
                    type="text"
                    id="expirationYear"
                    name="expirationYear"
                    defaultValue="28"
                    placeholder="26"
                  />
                </div>
                <div className="cvv">
                  <label className="cvv-label" htmlFor="CardComCvv">CVV</label>
                  <iframe
                    ref={cvvIframeRef}
                    id="CardComCvv"
                    name="CardComCvv"
                    src={`${CARDCOM_URL}/api/openfields/CVV`}
                    style={{ maxWidth: '197px', height: '57px' }}
                  />
                </div>
              </div>
              <div className="row">
                <iframe
                  ref={googlePayIframeRef}
                  allow="payment"
                  id="CardComGooglePay"
                  name="CardComGooglePay"
                  src={`${CARDCOM_URL}/api/openfields/GooglePay?terminalNumber=${import.meta.env.VITE_CARDCOM_TERMINAL_NUMBER}`}
                  style={{ maxWidth: '267px', height: '68px' }}
                />
              </div>
            </div>
          </div>
        </form>
      </div>
      <div className="footer">
        <iframe
          id="CardcomCredits"
          name="CardcomCredits"
          src={`${CARDCOM_URL}/api/openfields/credits?language=he&type=long`}
          width="100%"
          height="auto"
          style={{ zIndex: 2 }}
        />
      </div>
    </div>
  );
};

export default CheckoutForm;
